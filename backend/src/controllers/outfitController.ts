import type { NextFunction, Response } from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import TryOnResult from "../models/TryOnResult.ts";
import {
  createGeminiTryOnImage,
  GeminiTryOnServiceError,
  validateGeminiTryOnImage
} from "../services/geminiTryOnService.ts";
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
import {
  resolvePersonalModelValidationParts,
  resolveTryOnAvatar
} from "../services/tryOnAvatarService.ts";
import {
  buildTryOnRequestKey,
  finalizeTryOnQuota,
  getTryOnQuotaStatus,
  isLocalTryOnQuotaBypass,
  refundTryOnReservation,
  reserveTryOnQuota,
  TRY_ON_LIMIT_CODE,
  TRY_ON_LIMIT_MESSAGE,
  TRY_ON_RESERVATION_TTL_MS,
  type ReservationType
} from "../services/tryOnQuotaService.ts";
import { buildTryOnSuccessResponse } from "../services/tryOnResponseService.ts";
import { resolveSuccessfulTryOnQuota } from "../services/tryOnResultService.ts";
import {
  prepareTryOnGarmentInputs,
  resolveTryOnSelection
} from "../services/tryOnSelectionService.ts";
import {
  existingTryOnAction,
  qualityValidationError,
  type AvatarSource
} from "../services/tryOnValidationService.ts";

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

      const items = await Item.find({ user: req.userId, listingType: null }).select(
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
          message: "Your digital model photo must show one approximately front-facing person clearly visible from head to at least both knees."
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
        user: req.userId,
        listingType: null
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

export async function createTryOn(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
    try {
      const resolvedSelection = await resolveTryOnSelection(
        req.userId,
        req.body.selectionId
      );
      if (!resolvedSelection.success) {
        res.status(resolvedSelection.status).json({
          success: false,
          message: resolvedSelection.message
        });
        return;
      }
      const { selection, selectionItems, items } = resolvedSelection;

      const preparedGarments = await prepareTryOnGarmentInputs(selectionItems, items);
      if (!preparedGarments.success) {
        res.status(preparedGarments.status).json({
          success: false,
          message: preparedGarments.message
        });
        return;
      }
      const { orderedSelectionItems, tryOnInputs, responseItems } = preparedGarments;

      const avatarSource = req.body.avatarSource as AvatarSource;
      const avatar = await resolveTryOnAvatar({
        source: avatarSource,
        file: req.file,
        avatarId: req.body.avatarId,
        userId: req.userId
      });
      if (avatar.error || !avatar.data || !avatar.contentType || !avatar.identity) {
        res.status(avatar.status).json({ success: false, message: avatar.error });
        return;
      }

      const requestKey = buildTryOnRequestKey({
        userId: req.userId,
        selectionId: selection._id.toString(),
        avatarSource,
        avatarIdentity: `garment-lock-v3:${avatar.identity}`
      });
      if (isNoCostAiMockMode()) {
        const quota = await getTryOnQuotaStatus(req.userId);
        if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: avatar.data,
          contentType: avatar.contentType,
          items: responseItems,
          quota,
          cached: false
        }));
        return;
      }
      let existing = await TryOnResult.findOne({ requestKey });
      if (existing?.status === "succeeded" && existing.image?.data && existing.image.contentType) {
        const quota = await resolveSuccessfulTryOnQuota(req.userId, existing, requestKey);
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: existing.image.data,
          contentType: existing.image.contentType,
          items: responseItems,
          quota,
          cached: true
        }));
        return;
      }
      if (existing?.status === "pending") {
        const updatedAt = existing.updatedAt as Date;
        if (existingTryOnAction(
          "pending",
          updatedAt,
          new Date(),
          TRY_ON_RESERVATION_TTL_MS
        ) === "in-progress") {
          res.status(409).json({
            success: false,
            code: "TRY_ON_ALREADY_IN_PROGRESS",
            message: "This virtual try-on is already being created. Please wait a moment."
          });
          return;
        }
        const stale = await TryOnResult.findOneAndUpdate(
          { _id: existing._id, status: "pending", attemptId: existing.attemptId },
          { $set: { status: "failed", failureCode: "STALE_RESERVATION" } },
          { returnDocument: "after" }
        );
        if (stale?.reservationToken) {
          await refundTryOnReservation(req.userId, stale.reservationToken);
        }
        existing = stale;
      }

      const reservationToken = randomUUID();
      const attemptId = randomUUID();
      const reservation = isLocalTryOnQuotaBypass()
        ? { type: "free" as ReservationType, status: await getTryOnQuotaStatus(req.userId) }
        : await reserveTryOnQuota(req.userId, reservationToken);
      if (!reservation) {
        res.status(403).json({
          success: false,
          code: TRY_ON_LIMIT_CODE,
          message: TRY_ON_LIMIT_MESSAGE
        });
        return;
      }

      try {
        if (existing) {
          const claimed = await TryOnResult.findOneAndUpdate(
            { _id: existing._id, status: "failed" },
            {
              $set: {
                attemptId,
                status: "pending",
                reservationToken,
                reservationType: reservation.type,
                quotaCommitted: false,
                failureCode: null,
                avatarSource,
                avatarIdentity: avatar.identity
              }
            },
            { returnDocument: "after" }
          );
          if (!claimed) throw new Error("TRY_ON_REQUEST_ALREADY_CLAIMED");
        } else {
          await TryOnResult.create({
            owner: req.userId,
            selection: selection._id,
            requestKey,
            attemptId,
            status: "pending",
            reservationToken,
            reservationType: reservation.type,
            avatarSource,
            avatarIdentity: avatar.identity
          });
        }
      } catch (claimError) {
        await refundTryOnReservation(req.userId, reservationToken);
        const raced = await TryOnResult.findOne({ requestKey });
        if (raced?.status === "succeeded" && raced.image?.data && raced.image.contentType) {
          const quota = await resolveSuccessfulTryOnQuota(req.userId, raced, requestKey);
          res.json(buildTryOnSuccessResponse({
            selectionId: selection._id,
            imageData: raced.image.data,
            contentType: raced.image.contentType,
            items: responseItems,
            quota,
            cached: true
          }));
          return;
        }
        res.status(409).json({
          success: false,
          code: "TRY_ON_ALREADY_IN_PROGRESS",
          message: "This virtual try-on is already being created. Please wait a moment."
        });
        return;
      }

      try {
        const generated = await createGeminiTryOnImage(
          avatar.data,
          avatar.contentType,
          tryOnInputs
        );
        console.info(`Gemini try-on image completed with ${generated.model}`);
        const quality = await validateGeminiTryOnImage(
          generated.data,
          generated.contentType,
          avatar.data,
          avatar.contentType,
          tryOnInputs
        );
        const qualityError = qualityValidationError(quality, orderedSelectionItems);
        if (qualityError) throw new Error(`TRY_ON_QUALITY_REJECTED: ${qualityError}`);
        if (generated.data.length > 10 * 1024 * 1024) {
          throw new Error("TRY_ON_IMAGE_TOO_LARGE");
        }
        const saved = await TryOnResult.findOneAndUpdate(
          { requestKey, attemptId, status: "pending" },
          {
            $set: {
              status: "succeeded",
              image: { data: generated.data, contentType: generated.contentType },
              items: responseItems.map((entry) => ({
                item: entry.itemId,
                name: entry.name,
                detectedCategory: entry.detectedCategory
              })),
              validation: quality,
              failureCode: null
            }
          },
          { returnDocument: "after" }
        );
        if (!saved) throw new Error("TRY_ON_RESULT_SAVE_CONFLICT");
        const quota = isLocalTryOnQuotaBypass()
          ? await getTryOnQuotaStatus(req.userId)
          : await finalizeTryOnQuota(
              req.userId,
              reservationToken,
              reservation.type,
              requestKey
            );
        if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
        await TryOnResult.updateOne(
          { _id: saved._id, quotaCommitted: false },
          { $set: { quotaCommitted: true } }
        );
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: generated.data,
          contentType: generated.contentType,
          items: responseItems,
          quota,
          cached: false
        }));
        return;
      } catch (geminiError) {
        const failed = await TryOnResult.findOneAndUpdate(
          { requestKey, attemptId, status: "pending" },
          { $set: { status: "failed", failureCode: "GENERATION_FAILED" } },
          { returnDocument: "after" }
        );
        if (failed) await refundTryOnReservation(req.userId, reservationToken);
        console.error("Gemini try-on request failed", geminiError instanceof GeminiTryOnServiceError
          ? {
              stage: geminiError.stage,
              code: geminiError.code,
              httpStatus: geminiError.httpStatus,
              providerStatus: geminiError.providerStatus
            }
          : {
              stage: "unknown",
              code: geminiError instanceof Error && geminiError.name === "TimeoutError"
                ? "TIMEOUT"
                : "UNEXPECTED_ERROR"
            });
        res.status(502).json({
          success: false,
          message: "The virtual try-on service could not create the fitted image right now. Please try again shortly."
        });
        return;
      }
    } catch (error) {
      next(error);
    }
}
