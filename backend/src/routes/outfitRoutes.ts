import express from "express";
import Joi from "joi";
import multer from "multer";

import Item from "../models/Item.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";
import { createGeminiTryOnImage } from "../services/geminiTryOnService.ts";

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

const GEMINI_STYLIST_MODEL = "gemini-3.5-flash";

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
  selectedItems: Array<{
    id: string;
    detectedCategory: "Tops" | "Bottoms" | "Dresses" | "Jackets" | "Shoes" | "Bags" | "Accessories";
  }>;
  stylingTips: string[];
}

type OutfitCategory = OutfitSuggestion["selectedItems"][number]["detectedCategory"];

interface AnalyzedWardrobeItem {
  id: string;
  isValid: boolean;
  detectedCategory: OutfitCategory | "None";
  colorFamily: string;
  visualStyle: string;
  seasonSuitability: string[];
  formality: number;
  silhouette: string;
  eventSuitable: boolean;
  styleSuitable: boolean;
  weatherSuitable: boolean;
}

interface WardrobeCandidate {
  id: string;
  name: string;
  category: OutfitSuggestion["selectedItems"][number]["detectedCategory"];
  season: string;
  style: string;
  favorite: boolean;
  wearCount: number;
  lastWornAt?: Date | null;
  color: string;
  analysis: AnalyzedWardrobeItem;
}

const COMPLEMENTARY_CATEGORIES: OutfitCategory[] = [
  "Jackets", "Shoes", "Bags", "Accessories"
];

const weatherSeasons: Record<string, string[]> = {
  Warm: ["Summer", "Spring", "All Season"],
  Mild: ["Spring", "Fall", "All Season"],
  Cold: ["Winter", "Fall", "All Season"],
  Rainy: ["Fall", "Winter", "All Season"]
};

function normalizedColor(value: string) {
  const color = value.toLowerCase();
  const neutrals = ["black", "white", "gray", "grey", "beige", "cream", "brown", "navy", "denim"];
  return neutrals.some((neutral) => color.includes(neutral)) ? "neutral" : color;
}

function targetFormality(event: string) {
  const normalizedEvent = event.toLowerCase();
  if (/formal|wedding|gala|ceremony/.test(normalizedEvent)) return 5;
  if (/work|office|business|interview/.test(normalizedEvent)) return 4;
  if (/party|date|dinner|evening/.test(normalizedEvent)) return 3;
  if (/sport|gym|workout/.test(normalizedEvent)) return 1;
  return 2;
}

function candidateScore(item: WardrobeCandidate, request: { event: string; style: string; weather: string; preferFavorites: boolean }) {
  let score = item.analysis.eventSuitable && item.analysis.styleSuitable && item.analysis.weatherSuitable ? 12 : 0;
  if (item.analysis.visualStyle.toLowerCase().includes(request.style.toLowerCase()) || item.style === request.style) score += 6;
  if (item.analysis.seasonSuitability.some((season) => weatherSeasons[request.weather]?.includes(season)) || weatherSeasons[request.weather]?.includes(item.season)) score += 4;
  score -= Math.abs(item.analysis.formality - targetFormality(request.event)) * 2;
  if (request.preferFavorites && item.favorite) score += 2;
  score += Math.max(0, 3 - Math.min(item.wearCount || 0, 10) * 0.25);
  if (item.lastWornAt) score += Math.min(2, (Date.now() - new Date(item.lastWornAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return score;
}

function harmonyScore(items: WardrobeCandidate[]) {
  const colors = items.map((item) => normalizedColor(item.analysis.colorFamily || item.color));
  const nonNeutralColors = new Set(colors.filter((color) => color !== "neutral"));
  let score = nonNeutralColors.size <= 1 ? 4 : nonNeutralColors.size === 2 ? 2 : -3;
  const voluminousPieces = items.filter((item) =>
    /oversized|wide|voluminous|full|puffy|loose/i.test(item.analysis.silhouette)
  ).length;
  if (voluminousPieces > 1) score -= 3;
  return score;
}

function isRequestSuitable(item: WardrobeCandidate, request: { event: string }) {
  return item.analysis.eventSuitable && item.analysis.styleSuitable &&
    item.analysis.weatherSuitable &&
    Math.abs(item.analysis.formality - targetFormality(request.event)) <= 1;
}

function createLocalOutfitSuggestion(
  wardrobe: WardrobeCandidate[],
  request: {
    event: string;
    style: string;
    weather: string;
    preferFavorites: boolean;
  }
): OutfitSuggestion {
  const pool = wardrobe.filter((item) => isRequestSuitable(item, request));
  const tops = pool.filter((item) => item.category === "Tops");
  const bottoms = pool.filter((item) => item.category === "Bottoms");
  const dresses = pool.filter((item) => item.category === "Dresses");
  const bases: WardrobeCandidate[][] = [
    ...dresses.map((dress) => [dress]),
    ...tops.flatMap((top) => bottoms.map((bottom) => [top, bottom]))
  ];
  const selected = [...(bases.sort((left, right) =>
    right.reduce((sum, item) => sum + candidateScore(item, request), harmonyScore(right)) -
    left.reduce((sum, item) => sum + candidateScore(item, request), harmonyScore(left))
  )[0] || [])];

  if (selected.length > 0) {
    for (const category of COMPLEMENTARY_CATEGORIES) {
      const candidates = wardrobe.filter((item) =>
        item.category === category && isRequestSuitable(item, request)
      );
      if (candidates.length === 0) continue;
      if (category === "Jackets" && !["Cold", "Rainy"].includes(request.weather)) continue;
      const best = candidates.sort((left, right) =>
        candidateScore(right, request) + harmonyScore([...selected, right]) -
        candidateScore(left, request) - harmonyScore([...selected, left])
      )[0];
      if (best) selected.push(best);
    }
  }

  const selectedNames = selected.map((item) => item.name);

  return {
    title: `${request.style} ${request.event} Look`,
    explanation: selectedNames.length > 0
      ? `${selectedNames.join(", ")} form a coordinated ${request.style.toLowerCase()} look with compatible colors, season and formality for ${request.event.toLowerCase()}.`
      : "Your wardrobe does not yet contain a complete outfit for this request.",
    selectedItems: selected.map((item) => ({
      id: item.id,
      detectedCategory: item.category
    })),
    stylingTips: [
      selectedNames.length > 0
        ? `Wear the selected pieces together as a complete coordinated look for ${request.event}.`
        : "Add a dress, or both a top and a bottom, to create a complete look."
    ],
    analyzedItems: wardrobe.map((item) => item.analysis)
  };
}

function selectionValidationError(
  selections: OutfitSuggestion["selectedItems"],
  validWardrobe: WardrobeCandidate[],
  request: { event: string }
) {
  const validById = new Map(validWardrobe.map((item) => [item.id, item]));
  const ids = selections.map((selection) => selection.id);
  if (new Set(ids).size !== ids.length) return "The selected outfit contains duplicate items";

  for (const selection of selections) {
    const item = validById.get(selection.id);
    if (!item) return "The selected outfit contains an invalid wardrobe item";
    if (item.category !== selection.detectedCategory) return "The selected outfit contains a category mismatch";
    if (!item.analysis.eventSuitable) return "The selected outfit contains an item that is unsuitable for the requested event";
    if (!item.analysis.styleSuitable) return "The selected outfit does not match the requested style";
    if (!item.analysis.weatherSuitable) return "The selected outfit does not match the requested weather and season";
    if (Math.abs(item.analysis.formality - targetFormality(request.event)) > 1) {
      return "The selected outfit does not match the required level of formality";
    }
  }

  const count = (category: OutfitCategory) =>
    selections.filter((selection) => selection.detectedCategory === category).length;
  const dressCount = count("Dresses");
  const topCount = count("Tops");
  const bottomCount = count("Bottoms");
  const hasDressBase = dressCount === 1 && topCount === 0 && bottomCount === 0;
  const hasSeparatesBase = dressCount === 0 && topCount === 1 && bottomCount === 1;

  if (!hasDressBase && !hasSeparatesBase) {
    return "A complete outfit needs exactly one dress, or exactly one top and one bottom";
  }

  for (const category of COMPLEMENTARY_CATEGORIES) {
    if (count(category) > 1) return `The outfit may include at most one ${category.toLowerCase()} item`;
  }

  for (const category of ["Shoes", "Bags", "Accessories"] as OutfitCategory[]) {
    const categoryExists = validWardrobe.some((item) => item.category === category);
    if (categoryExists && count(category) !== 1) {
      return `The outfit must include one valid ${category.toLowerCase()} item from the wardrobe`;
    }
  }

  return "";
}

function incompleteWardrobeMessage(
  validWardrobe: WardrobeCandidate[],
  request: { event: string }
) {
  const categories = new Set(validWardrobe.map((item) => item.category));
  const hasDress = categories.has("Dresses");
  const hasTop = categories.has("Tops");
  const hasBottom = categories.has("Bottoms");

  if (!hasDress && !hasTop && !hasBottom) {
    return "A complete look cannot be created because your wardrobe has no valid dress, top or bottom image.";
  }
  if (!hasDress && !hasTop) {
    return "A complete look cannot be created because your wardrobe needs a valid top or dress image.";
  }
  if (!hasDress && !hasBottom) {
    return "A complete look cannot be created because your wardrobe needs a valid bottom or dress image.";
  }
  const suitable = validWardrobe.filter((item) => isRequestSuitable(item, request));
  const suitableCategories = new Set(suitable.map((item) => item.category));
  if (!suitableCategories.has("Dresses") &&
    !(suitableCategories.has("Tops") && suitableCategories.has("Bottoms"))) {
    return `Your wardrobe has a complete base, but no valid dress or top-and-bottom combination matches the event, style, weather and formality you selected.`;
  }
  for (const category of ["Shoes", "Bags", "Accessories"] as OutfitCategory[]) {
    if (categories.has(category) && !suitableCategories.has(category)) {
      return `A complete look cannot be created because the valid ${category.toLowerCase()} in your wardrobe do not match the event, style, weather and formality you selected.`;
    }
  }
  return "A complete, suitable look could not be created for this event from the valid items in your wardrobe.";
}

router.post(
  "/generate",
  async (req: AuthRequest, res, next) => {
    try {
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
        "name category color season style favorite wearCount lastWornAt image"
      );

      if (items.length === 0) {
        res.status(422).json({
          success: false,
          message: "Add at least one item to your closet before creating a look"
        });
        return;
      }

      const wardrobe = items.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        season: item.season,
        style: item.style,
        favorite: item.favorite,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt
      }));

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

      const prompt = [
        "You are ReStyle, a personal fashion stylist.",
        "First inspect every attached image yourself.",
        "Return exactly one analyzedItems entry for every attached item ID. Mark isValid false and detectedCategory None for rejected images.",
        "For each valid image report its visually detected category, dominant color family, visual style, suitable seasons, formality from 1 (very casual) to 5 (formal), silhouette or volume, and separate booleans for whether it is truly suitable for the requested event, requested style and requested weather.",
        "Ignore an item completely unless its image shows exactly one clear, dominant clothing product with its full shape and design visible.",
        "Reject closet scenes, clothing racks, piles, collages, people wearing clothes, full outfits with several garments, and images where the item is distant, cropped or unclear.",
        "Create one cohesive outfit using ONLY valid item IDs whose attached images clearly show real wearable items.",
        "Never trust an item's name or category when its image contradicts them.",
        "Never invent, recommend or mention any clothing, shoes, bag or accessory that is not among the valid attached wardrobe images.",
        "A complete outfit MUST contain exactly one of these two bases: (1) one Tops item plus one Bottoms item, or (2) one Dresses item. Never combine a dress with a top or bottom.",
        "Jackets, Shoes, Bags and Accessories never count as the required outfit base.",
        "Jackets means outerwear worn over the completed outfit, including jackets, coats, blazers and trench coats. It never means a long-sleeve shirt, blouse, sweatshirt or ordinary sweater.",
        "A jacket is an optional outer layer. Include at most one suitable jacket when it improves the outfit for the requested event and weather.",
        "If at least one valid Shoes item exists, the completed outfit MUST include exactly one suitable pair of shoes.",
        "If at least one valid Bags item exists, the completed outfit MUST include exactly one suitable bag. If at least one valid Accessories item exists, it MUST include exactly one suitable accessory without overloading the look.",
        "Select exactly one top and one bottom OR exactly one dress, plus at most one jacket, one pair of shoes, one bag and one accessory.",
        "Return each selected item's visually detected category, based on the image rather than its claimed metadata.",
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

      const imageParts = imageItems.flatMap((item) => [
          {
            text: `The next image belongs to item ID ${item._id.toString()} (${item.name}, claimed category: ${item.category}).`
          },
          {
            inline_data: {
              mime_type: item.image.contentType,
              data: item.image.data.toString("base64")
            }
          }
        ]);

      const { response: aiResponse, data: aiData, model: usedModel } =
        await requestGeminiStylist(apiKey, {
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
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      isValid: { type: "BOOLEAN" },
                      detectedCategory: { type: "STRING", enum: ["Tops", "Bottoms", "Dresses", "Jackets", "Shoes", "Bags", "Accessories", "None"] },
                      colorFamily: { type: "STRING" },
                      visualStyle: { type: "STRING" },
                      seasonSuitability: { type: "ARRAY", items: { type: "STRING", enum: ["Summer", "Winter", "Spring", "Fall", "All Season"] } },
                      formality: { type: "INTEGER", minimum: 1, maximum: 5 },
                      silhouette: { type: "STRING" },
                      eventSuitable: { type: "BOOLEAN" },
                      styleSuitable: { type: "BOOLEAN" },
                      weatherSuitable: { type: "BOOLEAN" }
                    },
                    required: ["id", "isValid", "detectedCategory", "colorFamily", "visualStyle", "seasonSuitability", "formality", "silhouette", "eventSuitable", "styleSuitable", "weatherSuitable"]
                  }
                },
                selectedItems: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      detectedCategory: {
                        type: "STRING",
                        enum: [
                          "Tops",
                          "Bottoms",
                          "Dresses",
                          "Jackets",
                          "Shoes",
                          "Bags",
                          "Accessories"
                        ]
                      }
                    },
                    required: ["id", "detectedCategory"]
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
      if (!outputText) throw new Error("The Gemini response did not include output text");

      const aiSuggestion = JSON.parse(outputText) as OutfitSuggestion;
      const itemsById = new Map(items.map((item) => [item._id.toString(), item]));
      const analyzedIds = new Set<string>();
      const validWardrobe: WardrobeCandidate[] = [];

      for (const analysis of Array.isArray(aiSuggestion.analyzedItems) ? aiSuggestion.analyzedItems : []) {
        const item = itemsById.get(analysis.id);
        if (!item || analyzedIds.has(analysis.id)) continue;
        analyzedIds.add(analysis.id);
        if (!analysis.isValid || analysis.detectedCategory === "None" || !item.image?.data || !item.image.contentType) continue;
        validWardrobe.push({
          id: analysis.id,
          name: item.name,
          category: analysis.detectedCategory,
          color: item.color,
          season: item.season,
          style: item.style,
          favorite: item.favorite,
          wearCount: item.wearCount,
          lastWornAt: item.lastWornAt,
          analysis
        });
      }

      if (analyzedIds.size !== imageItems.length || imageItems.some((item) => !analyzedIds.has(item._id.toString()))) {
        res.status(502).json({
          success: false,
          message: "The wardrobe image inspection was incomplete. Please try again."
        });
        return;
      }

      const hasCompleteBase = validWardrobe.some((item) => item.category === "Dresses") ||
        (validWardrobe.some((item) => item.category === "Tops") && validWardrobe.some((item) => item.category === "Bottoms"));
      if (!hasCompleteBase) {
        res.status(422).json({ success: false, message: incompleteWardrobeMessage(validWardrobe, value) });
        return;
      }

      let suggestion = aiSuggestion;
      let validationError = selectionValidationError(
        Array.isArray(aiSuggestion.selectedItems) ? aiSuggestion.selectedItems : [],
        validWardrobe,
        value
      );

      if (validationError) {
        console.warn(`Gemini outfit selection rejected: ${validationError}. Using validated local fallback.`);
        suggestion = createLocalOutfitSuggestion(validWardrobe, value);
        validationError = selectionValidationError(suggestion.selectedItems, validWardrobe, value);
      }

      if (validationError || suggestion.selectedItems.length === 0) {
        res.status(422).json({ success: false, message: incompleteWardrobeMessage(validWardrobe, value) });
        return;
      }

      const selectedIds = suggestion.selectedItems.map((selection) => selection.id);

      const selectedItems = selectedIds.map((id) => {
        const item = itemsById.get(id)!;
        const image = item.image?.data && item.image?.contentType
          ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
          : "";

        return {
          _id: item._id,
          name: item.name,
          category: item.category,
          detectedCategory: suggestion.selectedItems.find((selection) =>
            selection.id === id
          )?.detectedCategory,
          color: item.color,
          image
        };
      });

      res.json({
        success: true,
        outfit: {
          title: suggestion.title,
          explanation: suggestion.explanation,
          stylingTips: suggestion.stylingTips,
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
