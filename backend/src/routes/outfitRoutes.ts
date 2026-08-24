import express from "express";
import Joi from "joi";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";

import Item from "../models/Item.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";
import { createGeminiTryOnImage } from "../services/geminiTryOnService.ts";
import {
  createBalancedWardrobeShortlist,
  DETECTED_CATEGORIES,
  isDetectedCategory,
  normalizeProjectCategory,
  selectedOutfitValidationError,
  type DetectedCategory,
  type SelectedOutfitItem,
  type VerifiedCandidate
} from "../services/outfitSelectionService.ts";

const router = express.Router();
const tryOnUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(new Error("The virtual model must be a JPG, PNG or WEBP image"));
      return;
    }

    callback(null, true);
  }
});

router.use(authenticateToken);

const outfitRequestSchema = Joi.object({
  event: Joi.string().trim().min(2).max(250).required(),
  style: Joi.string()
    .valid("Casual", "Classic", "Elegant", "Sporty", "Streetwear")
    .required(),
  weather: Joi.string()
    .valid("Warm", "Mild", "Cold", "Rainy")
    .required(),
  preferFavorites: Joi.boolean().required()
});

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const GEMINI_STYLIST_MODEL = "gemini-3.1-flash-lite";

async function requestGeminiStylist(
  apiKey: string,
  requestBody: object
): Promise<{ response: Response; data: GeminiResponse; model: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STYLIST_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(90 * 1000)
    }
  );
  const data = await response.json() as GeminiResponse;
  return { response, data, model: GEMINI_STYLIST_MODEL };
}

interface OutfitSuggestion {
  title: string;
  explanation: string;
  analyzedItems: AnalyzedWardrobeItem[];
  selectedItems: SelectedOutfitItem[];
  stylingTips: string[];
}

interface AnalyzedWardrobeItem {
  itemId: string;
  isValid: boolean;
  detectedCategory: DetectedCategory | "None";
  colorFamily: string;
  visualStyle: string;
  seasonSuitability: string[];
  formality: number;
  silhouette: string;
  eventSuitable: boolean;
  styleSuitable: boolean;
  weatherSuitable: boolean;
}

const VALID_SEASONS = new Set([
  "Summer", "Winter", "Spring", "Fall", "All Season"
]);

function isValidAnalyzedWardrobeItem(
  value: unknown,
  candidateIds: Set<string>
): value is AnalyzedWardrobeItem {
  if (!value || typeof value !== "object") return false;
  const analysis = value as AnalyzedWardrobeItem;
  const categoryIsValid = analysis.detectedCategory === "None" ||
    isDetectedCategory(analysis.detectedCategory);

  return Boolean(
    typeof analysis.itemId === "string" &&
    candidateIds.has(analysis.itemId) && typeof analysis.isValid === "boolean" &&
    categoryIsValid && analysis.isValid === (analysis.detectedCategory !== "None") &&
    typeof analysis.colorFamily === "string" &&
    typeof analysis.visualStyle === "string" &&
    Array.isArray(analysis.seasonSuitability) &&
    analysis.seasonSuitability.every((season) => VALID_SEASONS.has(season)) &&
    Number.isInteger(analysis.formality) && analysis.formality >= 1 && analysis.formality <= 5 &&
    typeof analysis.silhouette === "string" &&
    typeof analysis.eventSuitable === "boolean" &&
    typeof analysis.styleSuitable === "boolean" &&
    typeof analysis.weatherSuitable === "boolean"
  );
}

function isSafeStylistText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 &&
    !/(?:https?:\/\/|www\.|\bbuy\b|\bpurchase\b|\bshop\b)/i.test(value);
}


router.post(
  "/generate",
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
        res.status(401).json({
          success: false,
          message: "Authentication is required"
        });
        return;
      }

      const { error, value } = outfitRequestSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0].message
        });
        return;
      }

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

      const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      const imageItems = items.filter((item) =>
        item.image?.data?.length && item.image.contentType && supportedImageTypes.has(item.image.contentType)
      );

      if (imageItems.length === 0) {
        res.status(422).json({
          success: false,
          message: "A complete look cannot be created because your wardrobe has no clear, supported item images."
        });
        return;
      }

      const shortlistedItems = createBalancedWardrobeShortlist(
        imageItems.map((item) => ({
          item,
          id: item._id.toString(),
          category: item.category,
          favorite: item.favorite,
          wearCount: item.wearCount,
          lastWornAt: item.lastWornAt
        })),
        30
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

      const prompt = [
        "You are ReStyle, a personal fashion stylist.",
        "First inspect every attached image yourself.",
        "Return exactly one analyzedItems entry for every attached item ID. Mark isValid false and detectedCategory None for rejected images.",
        "For each valid image report its visually detected category, dominant color family, visual style, suitable seasons, formality from 1 (very casual) to 5 (formal), silhouette or volume, and separate booleans for whether it is truly suitable for the requested event, requested style and requested weather.",
        "Accept a valid item image when it shows either one clear product by itself or one person clearly wearing the intended product. When worn, the intended product must remain unambiguous and its color, cut, shape and design must be reliably visible.",
        "Normal accompanying clothes on one person are allowed only when the intended product and its category are visually clear. Reject closet scenes, clothing racks, piles, collages, screenshots, groups of people, full-outfit photos where no single intended product is clear, and images where the intended product is distant, blurred, hidden, heavily cropped or too small.",
        "Create one cohesive outfit using ONLY valid item IDs whose attached images clearly show real wearable items.",
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
        "Use wearCount and lastWornAt for variety only after suitability and harmony; never choose an unsuitable item merely because it was worn less recently.",
        "Do not select a piece merely because it exists. If the wardrobe has no complete outfit that fits the event, return an empty selectedItems array.",
        "Prefer favorites only when the request says preferFavorites is true.",
        "If a complete outfit base cannot be made, return an empty selectedItems array. Do not return a partial outfit.",
        "Every styling tip must refer only to a selected or available valid wardrobe item. Do not suggest buying or adding anything.",
        "If no attached image shows a valid wardrobe item, return an empty selectedItems array.",
        "Keep the explanation concise and encouraging.",
        JSON.stringify({ request: value, wardrobe })
      ].join("\n");

      const imageParts = (await Promise.all(shortlistedItems.map(async ({ item, id }) => {
        const inspectionImage = await sharp(item.image.data)
          .rotate()
          .resize({ width: 896, height: 896, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();

        return [
          {
            text: `The next image belongs only to internal itemId ${id}. Its claimed category ${item.category} is supporting metadata, not visual truth.`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: inspectionImage.toString("base64")
            }
          }
        ];
      }))).flat();

      let geminiResult: Awaited<ReturnType<typeof requestGeminiStylist>>;

      try {
        geminiResult = await requestGeminiStylist(apiKey, {
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                ...imageParts
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                explanation: { type: "STRING" },
                analyzedItems: {
                  type: "ARRAY",
                  minItems: 1,
                  maxItems: 30,
                  items: {
                    type: "OBJECT",
                    properties: {
                      itemId: { type: "STRING" },
                      isValid: { type: "BOOLEAN" },
                      detectedCategory: { type: "STRING", enum: [...DETECTED_CATEGORIES, "None"] },
                      colorFamily: { type: "STRING" },
                      visualStyle: { type: "STRING" },
                      seasonSuitability: { type: "ARRAY", items: { type: "STRING", enum: ["Summer", "Winter", "Spring", "Fall", "All Season"] } },
                      formality: { type: "INTEGER", minimum: 1, maximum: 5 },
                      silhouette: { type: "STRING" },
                      eventSuitable: { type: "BOOLEAN" },
                      styleSuitable: { type: "BOOLEAN" },
                      weatherSuitable: { type: "BOOLEAN" }
                    },
                    required: ["itemId", "isValid", "detectedCategory", "colorFamily", "visualStyle", "seasonSuitability", "formality", "silhouette", "eventSuitable", "styleSuitable", "weatherSuitable"]
                  }
                },
                selectedItems: {
                  type: "ARRAY",
                  minItems: 0,
                  maxItems: 7,
                  items: {
                    type: "OBJECT",
                    properties: {
                      itemId: { type: "STRING" },
                      detectedCategory: {
                        type: "STRING",
                        enum: DETECTED_CATEGORIES
                      },
                      reason: { type: "STRING" }
                    },
                    required: ["itemId", "detectedCategory", "reason"]
                  }
                },
                stylingTips: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  minItems: 1,
                  maxItems: 3
                }
              },
              required: [
                "title",
                "explanation",
                "analyzedItems",
                "selectedItems",
                "stylingTips"
              ]
            }
          }
        });
      } catch (geminiError) {
        console.error("Gemini wardrobe inspection request failed:", geminiError);
        res.status(503).json({
          success: false,
          message: "The wardrobe image inspection took too long or is temporarily unavailable. Please try again."
        });
        return;
      }

      const { response: aiResponse, data: aiData, model: usedModel } = geminiResult;

      if (!aiResponse.ok) {
        console.error(
          `Gemini API error from ${GEMINI_STYLIST_MODEL}:`,
          aiData.error?.message
        );
      } else {
        console.info(`Gemini stylist completed with ${usedModel}`);
      }

      if (!aiResponse.ok) {
        res.status(503).json({
          success: false,
          message: "The wardrobe images could not be inspected right now. Please try again shortly."
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
        console.error("Gemini wardrobe inspection returned invalid JSON:", parseError);
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an incomplete result. Please try again."
        });
        return;
      }

      if (!aiSuggestion || !isSafeStylistText(aiSuggestion.title) ||
        !isSafeStylistText(aiSuggestion.explanation) ||
        !Array.isArray(aiSuggestion.stylingTips) ||
        aiSuggestion.stylingTips.length < 1 || aiSuggestion.stylingTips.length > 3 ||
        aiSuggestion.stylingTips.some((tip) => !isSafeStylistText(tip)) ||
        !Array.isArray(aiSuggestion.analyzedItems) ||
        aiSuggestion.analyzedItems.length !== shortlistedItems.length ||
        !Array.isArray(aiSuggestion.selectedItems)) {
        res.status(502).json({
          success: false,
          message: "The wardrobe inspection returned an incomplete result. Please try again."
        });
        return;
      }

      const analyzedIds = new Set<string>();
      const analysisById = new Map<string, AnalyzedWardrobeItem>();
      let invalidAnalysis = false;

      for (const analysis of aiSuggestion.analyzedItems) {
        if (!isValidAnalyzedWardrobeItem(analysis, candidateIds) ||
          analyzedIds.has(analysis.itemId)) {
          invalidAnalysis = true;
          break;
        }
        analyzedIds.add(analysis.itemId);
        analysisById.set(analysis.itemId, analysis);
      }

      if (invalidAnalysis || analyzedIds.size !== shortlistedItems.length ||
        shortlistedItems.some(({ id }) => !analyzedIds.has(id))) {
        res.status(502).json({
          success: false,
          message: "The wardrobe image inspection was incomplete. Please try again."
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
          message: "Your wardrobe does not contain enough valid items for a complete look. Add a dress, or both a top and a bottom."
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
          hasValidImage: Boolean(
            item?.image?.data?.length && item.image.contentType &&
            supportedImageTypes.has(item.image.contentType)
          ),
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
        console.warn(`Gemini outfit selection rejected: ${validationError || "ownership verification failed"}`);
        res.status(422).json({
          success: false,
          message: "The AI stylist could not create a valid complete look from your wardrobe. Please adjust your request and try again."
        });
        return;
      }

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
        outfit: {
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

router.post(
  "/try-on",
  tryOnUpload.single("modelImage"),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({
          success: false,
          message: "Choose an illustrated avatar or upload a full-body photo"
        });
        return;
      }

      let itemIds: unknown;

      try {
        itemIds = JSON.parse(req.body.itemIds || "[]");
      } catch {
        itemIds = [];
      }

      if (
        !Array.isArray(itemIds) ||
        itemIds.length === 0 ||
        itemIds.length > 6 ||
        new Set(itemIds).size !== itemIds.length ||
        itemIds.some((id) =>
          typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)
        )
      ) {
        res.status(400).json({
          success: false,
          message: "The selected outfit is not valid"
        });
        return;
      }

      const items = await Item.find({
        _id: { $in: itemIds },
        user: req.userId
      }).select("name category image");

      const itemById = new Map(
        items.map((item) => [item._id.toString(), item])
      );
      const orderedItems = itemIds
        .map((id) => itemById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (orderedItems.length !== itemIds.length) {
        res.status(400).json({
          success: false,
          message: "One or more selected items no longer exist in your wardrobe"
        });
        return;
      }

      const top = orderedItems.find((item) => item.category === "Tops");
      const bottom = orderedItems.find((item) => item.category === "Bottoms");
      const dress = orderedItems.find((item) => item.category === "Dresses");

      if (!dress && (!top || !bottom)) {
        res.status(400).json({
          success: false,
          message: "A try-on needs a dress, or both a top and a bottom"
        });
        return;
      }

      const missingImage = orderedItems.find((item) =>
        !item.image?.data || !item.image?.contentType
      );

      if (missingImage) {
        res.status(400).json({
          success: false,
          message: `The item "${missingImage.name}" needs an image for virtual try-on`
        });
        return;
      }

      const tryOnInputs = orderedItems.map((item) => ({
        name: item.name,
        category: item.category,
        data: item.image!.data,
        contentType: item.image!.contentType
      }));
      try {
        const generated = await createGeminiTryOnImage(
          req.file.buffer,
          req.file.mimetype,
          tryOnInputs
        );

        res.json({
          success: true,
          renderer: "gemini",
          tryOnImage: `data:${generated.contentType};base64,${generated.data.toString("base64")}`
        });
        return;
      } catch (geminiError) {
        console.error("Gemini try-on error:", geminiError);
        res.status(502).json({
          success: false,
          message: "The virtual try-on service could not create the fitted image right now. Please try again shortly."
        });
        return;
      }
    } catch (error) {
      console.error("Virtual try-on error:", error);

      res.status(502).json({
        success: false,
        message: "The virtual try-on service could not create the fitted image right now. Please try again shortly."
      });
    }
  }
);

export default router;
