import express from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import sharp, { type Metadata } from "sharp";

import { getTryOnStatus } from "../controllers/outfitController.ts";
import {
  deleteSavedOutfit,
  getSavedOutfits,
  saveOutfit
} from "../controllers/savedOutfitController.ts";
import Item from "../models/Item.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import TryOnResult from "../models/TryOnResult.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";
import { createUserRateLimit } from "../middleware/userRateLimit.ts";
import { tryOnImageUpload } from "../middleware/tryOnUpload.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  createGeminiTryOnImage,
  inferRequiredGarmentType,
  validateGeminiTryOnImage,
  GeminiTryOnServiceError
} from "../services/geminiTryOnService.ts";
import {
  buildGeminiWardrobeImageParts,
  GEMINI_STYLIST_MAX_ITEMS,
  GEMINI_STYLIST_MODEL,
  GEMINI_STYLIST_RESPONSE_SCHEMA,
  isCompleteStylistSuggestion,
  isNoCostAiMockMode,
  isSafeStylistText,
  requestGeminiStylist,
  type OutfitSuggestion
} from "../services/geminiStylistService.ts";
import {
  isPersonalAvatarAcceptable,
  normalizeAnalyzedWardrobeItem,
  normalizeGeminiCategory,
  type AnalyzedWardrobeItem
} from "../services/geminiStylistValidationService.ts";
import {
  createBalancedWardrobeShortlist,
  hasSupportedWardrobeImage,
  isDetectedCategory,
  normalizeProjectCategory,
  outfitCohesionValidationError,
  selectNoCostOutfitItems,
  selectedOutfitValidationError,
  type DetectedCategory,
  type SelectedOutfitItem,
  type VerifiedCandidate
} from "../services/outfitSelectionService.ts";
import {
  hasForbiddenTryOnOverrides,
  existingTryOnAction,
  orderTryOnItems,
  qualityValidationError,
  resourceOwnershipError,
  validateTryOnComposition,
  type AvatarSource,
  type TryOnItemDescriptor
} from "../services/tryOnValidationService.ts";
import {
  resolvePersonalModelValidationParts,
  resolveTryOnAvatar,
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
import {
  outfitRequestSchema,
  savedLookParamsSchema,
  saveOutfitSchema
} from "../validation/outfitValidation.ts";

const router = express.Router();
const generateRateLimit = createUserRateLimit({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  code: "OUTFIT_GENERATE_RATE_LIMITED",
  message: "You are creating looks too quickly. Please wait a few minutes and try again."
});
const tryOnRateLimit = createUserRateLimit({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
  code: "TRY_ON_RATE_LIMITED",
  message: "You are creating virtual try-ons too quickly. Please wait a few minutes and try again."
});
router.use(authenticateToken);

router.post(
  "/generate",
  generateRateLimit,
  validate(outfitRequestSchema),
  async (req: AuthRequest, res, next) => {
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

      const prompt = [
        "You are ReStyle, a personal fashion stylist.",
        "First inspect every attached image yourself.",
        "Return exactly one analyzedItems entry for every attached item ID. Mark isValid false and detectedCategory None for rejected images.",
        "For each image return its visually detected category, a precise short visualDescription of the exact garment subtype and silhouette (for example pleated midi skirt, straight-leg jeans, tailored shorts), and separate booleans for whether it is truly suitable for the requested event, requested style and requested weather.",
        "Accept a valid item image when it shows either one clear product by itself or one person clearly wearing the intended product. When worn, the intended product must remain unambiguous and its color, cut, shape and design must be reliably visible.",
        "Normal accompanying clothes on one person are allowed only when the intended product and its category are visually clear. Reject closet scenes, clothing racks, piles, collages, screenshots, groups of people, full-outfit photos where no single intended product is clear, and images where the intended product is distant, blurred, hidden, heavily cropped or too small.",
        "Create one cohesive outfit using ONLY valid item IDs whose attached images clearly show real wearable items.",
        "CONSISTENCY RULE: selectedItems may contain ONLY analyzedItems where isValid, eventSuitable, styleSuitable and weatherSuitable are all true.",
        "Every selected item must have all three suitability booleans set to true in its analyzedItems entry. Never select an item while marking any of those booleans false.",
        "Before returning JSON, cross-check every selected item against analyzedItems and revise the selection if there is any contradiction.",
        "Never trust an item's name or category when its image contradicts them.",
        "Never invent, recommend or mention any clothing, shoes, bag or accessory that is not among the valid attached wardrobe images.",
        "Use only these normalized detectedCategory values: Dress, Top, Bottom, Jacket, Shoes, Bag, Accessory. Use None only for an invalid analyzed image.",
        "A complete outfit MUST contain exactly one of these two bases: (1) one Top plus one Bottom, or (2) one Dress. Never combine a Dress with a Top or Bottom.",
        "Jacket, Shoes, Bag and Accessory never count as the required outfit base.",
        "Jacket means outerwear worn over the completed outfit, including jackets, coats, blazers and trench coats. It never means a long-sleeve shirt, blouse, sweatshirt or ordinary sweater.",
        "A jacket is an optional outer layer. Include at most one suitable jacket when it improves the outfit for the requested event and weather.",
        "If at least one valid Shoes item exists, the completed outfit MUST include exactly one suitable pair of shoes.",
        "If at least one valid Bags item exists, the completed outfit MUST include exactly one suitable bag. If at least one valid Accessories item exists, it MUST include exactly one suitable accessory without overloading the look.",
        "Select exactly one top and one bottom OR exactly one dress, plus at most one jacket, one pair of shoes, one bag and one accessory.",
        "Return each selected item's itemId, visually detected category based on the image rather than claimed metadata, and a short reason.",
        "The requested event is a HARD constraint, not a suggestion. The outfit must be genuinely appropriate for that event.",
        "For Work choose polished, professional and practical pieces. For Party choose festive, expressive evening-appropriate pieces. For Formal choose refined dressy pieces. For Date choose stylish occasion-appropriate pieces. For Casual choose relaxed everyday pieces. For a custom event infer its real dress code from the user's description.",
        "After satisfying the event, match the requested style and weather, then coordinate categories, colors and season.",
        "Coordinate silhouettes and volumes, match shoes to the base, match the bag to the shoes and overall look, and keep the accessory restrained.",
        "Before returning the outfit, evaluate the selected pieces together as one complete look. All selected colors, formality levels, silhouettes and the requested occasion must coordinate; individual suitability is not enough.",
        "Set every cohesion boolean to true only when the complete outfit genuinely works together. If any cohesion check would be false, revise the selection. If no cohesive selection exists, return an empty selectedItems array and explain why.",
        "Use wearCount and lastWornAt for variety only after suitability and harmony; never choose an unsuitable item merely because it was worn less recently.",
        "Do not select a piece merely because it exists. If the wardrobe has no complete outfit that fits the event, return an empty selectedItems array.",
        "When preferFavorites is true, every attached wardrobe image is a verified favorite and every selected item must come only from those attached favorites.",
        "If a complete outfit base cannot be made, return an empty selectedItems array. Do not return a partial outfit.",
        "Every styling tip must refer only to a selected or available valid wardrobe item. Do not suggest buying or adding anything.",
        "If no attached image shows a valid wardrobe item, return an empty selectedItems array.",
        "Keep the explanation concise and encouraging.",
        value.avatarSource === "personal"
          ? "Validate the separately labeled PERSONAL MODEL PHOTO. avatarValidation.valid may be true only when there is exactly one person, their face is clear, they are approximately front-facing, and their entire body including head, legs and both feet is visible. A selfie, seated pose, side-facing pose, cropped body, hidden feet or face, group photo, or distant person is invalid."
          : "No personal model photo was requested. Return every avatarValidation boolean as true and reason as Preset avatar.",
        "Return one JSON object matching the provided response schema. The cohesion reason must briefly explain why the selected pieces work together. Keep stylingTips to between one and three short strings.",
        JSON.stringify({ request: value, wardrobe })
      ].join("\n");

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
        const message = aiResponse.status === 429
          ? "The AI styling allowance is temporarily busy or exhausted. Please check your Gemini quota and try again later."
          : aiResponse.status === 401 || aiResponse.status === 403
            ? "Gemini access was rejected. Check that the Gemini API is enabled and that this API key is allowed to use it."
            : aiResponse.status === 400 || aiResponse.status === 413
              ? "The wardrobe image request was too large or was rejected by Gemini. Try with fewer or smaller wardrobe images."
              : "The wardrobe images could not be inspected right now. Please try again shortly.";
        res.status(503).json({
          success: false,
          code: "GEMINI_STYLIST_REQUEST_FAILED",
          message
        });
        return;
      }

      const outputText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!outputText) {
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned no result. Please try again."
        });
        return;
      }

      let aiSuggestion: OutfitSuggestion;

      try {
        aiSuggestion = JSON.parse(outputText) as OutfitSuggestion;
      } catch (parseError) {
        console.error("Gemini wardrobe inspection returned invalid JSON");
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an incomplete result. Please try again."
        });
        return;
      }

      if (!isCompleteStylistSuggestion(aiSuggestion, shortlistedItems.length)) {
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an incomplete result. Please try again."
        });
        return;
      }

      if (value.avatarSource === "personal" &&
        !isPersonalAvatarAcceptable(aiSuggestion.avatarValidation)) {
        res.status(422).json({
          success: false,
          code: "VIRTUAL_MODEL_PHOTO_UNSUITABLE",
          message: "Your digital model photo must show one front-facing person with the full body visible from head to both feet."
        });
        return;
      }

      const analyzedIds = new Set<string>();
      const analysisById = new Map<string, AnalyzedWardrobeItem>();
      let invalidAnalysis = false;

      const normalizedAnalyses: AnalyzedWardrobeItem[] = [];
      for (const rawAnalysis of aiSuggestion.analyzedItems) {
        const analysis = normalizeAnalyzedWardrobeItem(rawAnalysis, candidateIds);
        if (!analysis || analyzedIds.has(analysis.itemId)) {
          invalidAnalysis = true;
          break;
        }
        analyzedIds.add(analysis.itemId);
        analysisById.set(analysis.itemId, analysis);
        normalizedAnalyses.push(analysis);
      }

      if (invalidAnalysis || analyzedIds.size !== shortlistedItems.length ||
        shortlistedItems.some(({ id }) => !analyzedIds.has(id))) {
        res.status(502).json({
          success: false,
          message: "The wardrobe image inspection was incomplete. Please try again."
        });
        return;
      }

      aiSuggestion.analyzedItems = normalizedAnalyses;

      const normalizedSelections = aiSuggestion.selectedItems.map((selection) => {
        const detectedCategory = normalizeGeminiCategory(selection?.detectedCategory);
        return detectedCategory && detectedCategory !== "None"
          ? { ...selection, detectedCategory }
          : null;
      });
      if (normalizedSelections.some((selection) => !selection)) {
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an invalid outfit selection. Please try again."
        });
        return;
      }
      aiSuggestion.selectedItems = normalizedSelections as SelectedOutfitItem[];

      if (aiSuggestion.selectedItems.length > 0 &&
        outfitCohesionValidationError(aiSuggestion.cohesion)) {
        res.status(422).json({
          success: false,
          message: outfitCohesionValidationError(aiSuggestion.cohesion)
        });
        return;
      }

      const validAnalyses = aiSuggestion.analyzedItems.filter((analysis) =>
        analysis.isValid && analysis.detectedCategory !== "None"
      );
      const hasCompleteBase = validAnalyses.some((analysis) => analysis.detectedCategory === "Dress") ||
        (validAnalyses.some((analysis) => analysis.detectedCategory === "Top") &&
          validAnalyses.some((analysis) => analysis.detectedCategory === "Bottom"));

      if (!hasCompleteBase) {
        res.status(422).json({
          success: false,
          code: "WARDROBE_BASE_IMAGES_UNCLEAR",
          message: value.preferFavorites
            ? "Your favorites need one clear dress, or both a clear top and bottom, to create a favorites-only look."
            : "Gemini could not clearly identify a complete outfit base in your wardrobe photos. Replace the unclear dress photo, or the unclear top or bottom photo, with a well-lit image that clearly shows the entire item."
        });
        return;
      }

      if (aiSuggestion.selectedItems.some((selection) =>
        !selection || typeof selection.itemId !== "string" ||
        !mongoose.isValidObjectId(selection.itemId) ||
        !isDetectedCategory(selection.detectedCategory) ||
        !isSafeStylistText(selection.reason)
      )) {
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
      const verifiedCandidates = new Map<string, VerifiedCandidate>();

      for (const { id } of shortlistedItems) {
        const analysis = analysisById.get(id);
        const item = verifiedItemsById.get(id);
        if (!analysis || !analysis.isValid || analysis.detectedCategory === "None") continue;
        verifiedCandidates.set(id, {
          ownerVerified: Boolean(item),
          hasValidImage: Boolean(item && hasSupportedWardrobeImage(item)),
          detectedCategory: analysis.detectedCategory,
          eventSuitable: analysis.eventSuitable,
          styleSuitable: analysis.styleSuitable,
          weatherSuitable: analysis.weatherSuitable
        });
      }

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
);

router.get("/try-on/status", getTryOnStatus);

router.get("/saved", getSavedOutfits);
router.post("/saved", validate(saveOutfitSchema), saveOutfit);
router.delete(
  "/saved/:lookId",
  validateParams(savedLookParamsSchema),
  deleteSavedOutfit
);

router.post(
  "/try-on",
  tryOnRateLimit,
  tryOnImageUpload.single("modelImage"),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
        res.status(401).json({ success: false, message: "Authentication is required" });
        return;
      }
      if (hasForbiddenTryOnOverrides(req.body)) {
        res.status(400).json({
          success: false,
          message: "The try-on must use the saved verified outfit selection"
        });
        return;
      }
      if (!mongoose.isValidObjectId(req.body.selectionId)) {
        res.status(400).json({ success: false, message: "Choose a valid saved outfit" });
        return;
      }

      const selection = await OutfitSelection.findById(req.body.selectionId);
      if (!selection || selection.expiresAt <= new Date()) {
        res.status(404).json({ success: false, message: "The saved outfit was not found or has expired" });
        return;
      }
      if (selection.user.toString() !== req.userId) {
        res.status(403).json({ success: false, message: "You cannot use this saved outfit" });
        return;
      }
      const selectionItems: TryOnItemDescriptor[] = [];
      for (const entry of selection.items) {
        if (!isDetectedCategory(entry.detectedCategory)) {
          res.status(400).json({ success: false, message: "The saved outfit contains an invalid category" });
          return;
        }
        selectionItems.push({
          itemId: entry.item.toString(),
          detectedCategory: entry.detectedCategory,
          visualDescription: entry.visualDescription
        });
      }
      const compositionError = validateTryOnComposition(selectionItems);
      if (compositionError) {
        res.status(400).json({ success: false, message: compositionError });
        return;
      }

      const itemIds = selectionItems.map((entry) => entry.itemId);
      const items = await Item.find({ _id: { $in: itemIds } })
        .select("name category image user");
      const ownershipError = resourceOwnershipError({
        userId: req.userId,
        selectionOwnerId: selection.user.toString(),
        selectedItemIds: itemIds,
        items: items.map((item) => ({
          itemId: item._id.toString(),
          ownerId: item.user.toString()
        }))
      });
      if (ownershipError) {
        res.status(ownershipError.status).json({
          success: false,
          message: ownershipError.message
        });
        return;
      }

      const itemsById = new Map(items.map((item) => [item._id.toString(), item]));
      const orderedSelectionItems = orderTryOnItems(selectionItems);
      const tryOnInputs = [];
      for (const entry of orderedSelectionItems) {
        const item = itemsById.get(entry.itemId)!;
        if (!item.image?.data || !item.image.contentType ||
          !["image/jpeg", "image/png", "image/webp"].includes(item.image.contentType)) {
          res.status(404).json({
            success: false,
            message: `The selected item "${item.name}" no longer has a valid image`
          });
          return;
        }
        let metadata: Metadata;
        try {
          metadata = await sharp(item.image.data).metadata();
        } catch {
          res.status(404).json({
            success: false,
            message: `The selected item "${item.name}" has a damaged image`
          });
          return;
        }
        const expectedFormat = item.image.contentType === "image/jpeg"
          ? "jpeg"
          : item.image.contentType.replace("image/", "");
        if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
          res.status(404).json({
            success: false,
            message: `The selected item "${item.name}" has an invalid image format`
          });
          return;
        }
        tryOnInputs.push({
          itemId: entry.itemId,
          name: item.name,
          detectedCategory: entry.detectedCategory,
          visualDescription: entry.visualDescription,
          requiredGarmentType: inferRequiredGarmentType(
            item.name,
            entry.detectedCategory,
            entry.visualDescription
          ),
          data: item.image.data,
          contentType: item.image.contentType
        });
      }

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
      const responseItems = orderedSelectionItems.map((entry) => ({
        itemId: entry.itemId,
        detectedCategory: entry.detectedCategory,
        name: itemsById.get(entry.itemId)!.name
      }));
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
        let quota = await getTryOnQuotaStatus(req.userId);
        if (!isLocalTryOnQuotaBypass() && !existing.quotaCommitted &&
          existing.reservationToken && existing.reservationType) {
          quota = await finalizeTryOnQuota(
            req.userId,
            existing.reservationToken,
            existing.reservationType as ReservationType,
            requestKey
          );
          await TryOnResult.updateOne(
            { _id: existing._id, quotaCommitted: false },
            { $set: { quotaCommitted: true } }
          );
        }
        if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
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
          let quota = await getTryOnQuotaStatus(req.userId);
          if (!isLocalTryOnQuotaBypass() && !raced.quotaCommitted &&
            raced.reservationToken && raced.reservationType) {
            quota = await finalizeTryOnQuota(
              req.userId,
              raced.reservationToken,
              raced.reservationType as ReservationType,
              requestKey
            );
            await TryOnResult.updateOne(
              { _id: raced._id, quotaCommitted: false },
              { $set: { quotaCommitted: true } }
            );
          }
          if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
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
);

export default router;
