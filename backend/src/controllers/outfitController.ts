import type { NextFunction, Response } from "express";
import mongoose from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import {
  buildGeminiWardrobeImageParts,
  buildGeminiStylistPrompt,
  geminiStylistFailureMessage,
  GEMINI_STYLIST_MAX_ITEMS,
  GEMINI_STYLIST_MODEL,
  GEMINI_STYLIST_RESPONSE_SCHEMA,
  isNoCostAiMockMode,
  isValidStylistSelection,
  parseGeminiStylistSuggestion,
  requestGeminiStylist
} from "../services/geminiStylistService.ts";
import {
  isPersonalAvatarAcceptable,
  normalizeCompleteWardrobeAnalysis,
  normalizeSelectedOutfitItems
} from "../services/geminiStylistValidationService.ts";
import {
  buildVerifiedCandidates,
  createBalancedWardrobeShortlist,
  hasCompleteAnalyzedOutfitBase,
  hasSupportedWardrobeImage,
  normalizeProjectCategory,
  outfitCohesionValidationError,
  selectNoCostOutfitItems,
  selectedOutfitValidationError
} from "../services/outfitSelectionService.ts";
import { resolvePersonalModelValidationParts } from "../services/tryOnAvatarService.ts";
import { getTryOnQuotaStatus } from "../services/tryOnQuotaService.ts";

export async function getTryOnStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
      res.status(401).json({ success: false, message: "Authentication is required" });
      return;
    }

    const quota = await getTryOnQuotaStatus(req.userId);
    if (!quota) {
      res.status(404).json({ success: false, message: "User account not found" });
      return;
    }

    res.json(quota);
  } catch (error) {
    next(error);
  }
}

export async function generateOutfit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
    try {
      if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
        res.status(401).json({
          success: false,
          message: "Authentication is required"
        });
        return;
      }

      const value = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        res.status(503).json({
          success: false,
          message: "The AI service is not configured yet"
        });
        return;
      }

      const items = await Item.find({ user: req.userId }).select(
        "name category color season style favorite wearCount lastWornAt brand size condition description image"
      );

      if (items.length === 0) {
        res.status(422).json({
          success: false,
          message: "Add at least one item to your closet before creating a look"
        });
        return;
      }

      const imageItems = items.filter(hasSupportedWardrobeImage);

      if (imageItems.length === 0) {
        res.status(422).json({
          success: false,
          message: "A complete look cannot be created because your wardrobe has no clear, supported item images."
        });
        return;
      }

      const eligibleImageItems = value.preferFavorites
        ? imageItems.filter((item) => item.favorite === true)
        : imageItems;

      if (value.preferFavorites && eligibleImageItems.length === 0) {
        res.status(422).json({
          success: false,
          code: "NO_FAVORITE_WARDROBE_ITEMS",
          message: "Mark wardrobe pieces as favorites before creating a favorites-only look."
        });
        return;
      }

      if (isNoCostAiMockMode()) {
        const mockItems = selectNoCostOutfitItems(eligibleImageItems);
        if (mockItems.length === 0) {
          res.status(422).json({
            success: false,
            message: "Your wardrobe needs a dress, or both a top and a bottom, for the no-cost test."
          });
          return;
        }
        const savedSelection = await OutfitSelection.create({
          user: req.userId,
          title: "No-cost test look",
          explanation: "This deterministic look was assembled locally without calling Gemini.",
          stylingTips: ["This is a local flow test; no AI credits were used."],
          items: mockItems.map(({ item, detectedCategory }) => ({
            item: item._id,
            detectedCategory,
            reason: "Selected locally for the no-cost end-to-end test"
          }))
        });
        res.json({
          success: true,
          mockMode: true,
          selectionId: savedSelection._id,
          outfit: {
            selectionId: savedSelection._id,
            title: savedSelection.title,
            explanation: savedSelection.explanation,
            stylingTips: savedSelection.stylingTips,
            items: mockItems.map(({ item, detectedCategory }) => ({
              _id: item._id,
              name: item.name,
              category: item.category,
              detectedCategory,
              selectionReason: "Selected locally for the no-cost end-to-end test",
              color: item.color,
              image: `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
            }))
          }
        });
        return;
      }

      const shortlistedItems = createBalancedWardrobeShortlist(
        eligibleImageItems.map((item) => ({
          item,
          id: item._id.toString(),
          category: item.category,
          favorite: item.favorite,
          wearCount: item.wearCount,
          lastWornAt: item.lastWornAt
        })),
        GEMINI_STYLIST_MAX_ITEMS
      );
      const candidateIds = new Set(shortlistedItems.map(({ id }) => id));
      const wardrobe = shortlistedItems.map(({ item, id }) => ({
        itemId: id,
        name: item.name,
        category: item.category,
        normalizedClaimedCategory: normalizeProjectCategory(item.category),
        color: item.color,
        season: item.season,
        occasion: value.event,
        style: item.style,
        favorite: item.favorite,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
        brand: item.brand,
        size: item.size,
        condition: item.condition,
        description: item.description
      }));

      let personalModelPart: Array<Record<string, unknown>> = [];
      if (value.avatarSource === "personal") {
        const personalModel = await resolvePersonalModelValidationParts(req.userId);
        if (!personalModel.success) {
          res.status(personalModel.status).json({
            success: false,
            code: personalModel.code,
            message: personalModel.message
          });
          return;
        }
        personalModelPart = personalModel.parts;
      }

      const prompt = buildGeminiStylistPrompt(
        value,
        wardrobe,
        value.avatarSource
      );

      const imageParts = await buildGeminiWardrobeImageParts(shortlistedItems);

      let geminiResult: Awaited<ReturnType<typeof requestGeminiStylist>>;

      try {
        geminiResult = await requestGeminiStylist(apiKey, {
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                ...imageParts,
                ...personalModelPart
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_STYLIST_RESPONSE_SCHEMA
          }
        });
      } catch (geminiError) {
        if (geminiError instanceof Error &&
          geminiError.message === "GEMINI_STYLIST_PAYLOAD_TOO_LARGE") {
          res.status(413).json({
            success: false,
            code: "GEMINI_STYLIST_PAYLOAD_TOO_LARGE",
            message: "The wardrobe request is still too large after safe image optimization."
          });
          return;
        }
        console.error("Gemini wardrobe inspection request failed");
        res.status(503).json({
          success: false,
          message: "The wardrobe image inspection took too long or is temporarily unavailable. Please try again."
        });
        return;
      }

      const { response: aiResponse, data: aiData, model: usedModel } = geminiResult;

      if (!aiResponse.ok) {
        console.error("Gemini stylist request failed", {
          model: GEMINI_STYLIST_MODEL,
          httpStatus: aiResponse.status,
          providerCode: aiData.error?.code,
          providerStatus: aiData.error?.status
        });
      } else {
        console.info(`Gemini stylist completed with ${usedModel}`);
      }

      if (!aiResponse.ok) {
        res.status(503).json({
          success: false,
          code: "GEMINI_STYLIST_REQUEST_FAILED",
          message: geminiStylistFailureMessage(aiResponse.status)
        });
        return;
      }

      const outputText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedSuggestion = parseGeminiStylistSuggestion(
        outputText,
        shortlistedItems.length
      );
      if ("reason" in parsedSuggestion) {
        if (parsedSuggestion.reason === "missing") {
          res.status(502).json({
            success: false,
            message: "The wardrobe inspection returned no result. Please try again."
          });
          return;
        }
        if (parsedSuggestion.reason === "invalid-json") {
          console.error("Gemini wardrobe inspection returned invalid JSON");
        }
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an incomplete result. Please try again."
        });
        return;
      }
      const aiSuggestion = parsedSuggestion.suggestion;

      if (value.avatarSource === "personal" &&
        !isPersonalAvatarAcceptable(aiSuggestion.avatarValidation)) {
        res.status(422).json({
          success: false,
          code: "VIRTUAL_MODEL_PHOTO_UNSUITABLE",
          message: "Your digital model photo must show one front-facing person with the full body visible from head to both feet."
        });
        return;
      }

      const normalizedAnalysis = normalizeCompleteWardrobeAnalysis(
        aiSuggestion.analyzedItems,
        candidateIds
      );
      if (!normalizedAnalysis) {
        res.status(502).json({
          success: false,
          message: "The wardrobe image inspection was incomplete. Please try again."
        });
        return;
      }

      aiSuggestion.analyzedItems = normalizedAnalysis.analyses;
      const analysisById = normalizedAnalysis.byId;

      const normalizedSelections = normalizeSelectedOutfitItems(aiSuggestion.selectedItems);
      if (!normalizedSelections) {
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an invalid outfit selection. Please try again."
        });
        return;
      }
      aiSuggestion.selectedItems = normalizedSelections;

      if (aiSuggestion.selectedItems.length > 0 &&
        outfitCohesionValidationError(aiSuggestion.cohesion)) {
        res.status(422).json({
          success: false,
          message: outfitCohesionValidationError(aiSuggestion.cohesion)
        });
        return;
      }

      if (!hasCompleteAnalyzedOutfitBase(aiSuggestion.analyzedItems)) {
        res.status(422).json({
          success: false,
          code: "WARDROBE_BASE_IMAGES_UNCLEAR",
          message: value.preferFavorites
            ? "Your favorites need one clear dress, or both a clear top and bottom, to create a favorites-only look."
            : "Gemini could not clearly identify a complete outfit base in your wardrobe photos. Replace the unclear dress photo, or the unclear top or bottom photo, with a well-lit image that clearly shows the entire item."
        });
        return;
      }

      if (!aiSuggestion.selectedItems.every(isValidStylistSelection)) {
        res.status(502).json({
          success: false,
          message: "The AI stylist returned an invalid wardrobe selection. Please try again."
        });
        return;
      }
      const selectedIds = aiSuggestion.selectedItems.map((selection) => selection.itemId);

      const verifiedItems = await Item.find({
        _id: { $in: [...candidateIds] },
        user: req.userId
      }).select("name category color image");
      const verifiedItemsById = new Map(
        verifiedItems.map((item) => [item._id.toString(), item])
      );
      const verifiedCandidates = buildVerifiedCandidates(
        shortlistedItems,
        analysisById,
        verifiedItemsById
      );

      const validationError = selectedOutfitValidationError(
        aiSuggestion.selectedItems,
        verifiedCandidates
      );

      if (validationError || selectedIds.some((id) => !verifiedItemsById.has(id))) {
        console.warn("Gemini outfit selection was rejected by server validation:", validationError);
        const requestMismatch = validationError ===
          "The selected outfit contains an item that does not match the request";
        res.status(422).json({
          success: false,
          code: requestMismatch
            ? "NO_COMPLETE_OUTFIT_MATCHES_REQUEST"
            : "WARDROBE_ITEM_IMAGE_UNCLEAR",
          message: requestMismatch
            ? "Gemini could not find a complete outfit where every item matches this event, style and weather. Try changing one of those choices."
            : "Gemini could not reliably identify one or more selected wardrobe photos. Replace any unclear, cropped or distant item photo with a well-lit photo showing one complete item, then try again."
        });
        return;
      }

      const savedSelection = await OutfitSelection.create({
        user: req.userId,
        title: aiSuggestion.title,
        explanation: aiSuggestion.explanation,
        stylingTips: aiSuggestion.stylingTips,
          items: aiSuggestion.selectedItems.map((selection) => ({
            item: selection.itemId,
            detectedCategory: selection.detectedCategory,
            reason: selection.reason,
            visualDescription: analysisById.get(selection.itemId)?.visualDescription || ""
        }))
      });

      const selectedItems = selectedIds.map((id) => {
        const item = verifiedItemsById.get(id)!;
        const selection = aiSuggestion.selectedItems.find((entry) => entry.itemId === id)!;
        const image = item.image?.data && item.image?.contentType
          ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
          : "";

        return {
          _id: item._id,
          name: item.name,
          category: item.category,
          detectedCategory: selection.detectedCategory,
          selectionReason: selection.reason,
          color: item.color,
          image
        };
      });

      res.json({
        success: true,
        selectionId: savedSelection._id,
        outfit: {
          selectionId: savedSelection._id,
          title: aiSuggestion.title,
          explanation: aiSuggestion.explanation,
          stylingTips: aiSuggestion.stylingTips,
          items: selectedItems
        }
      });
    } catch (error) {
      next(error);
    }
}
