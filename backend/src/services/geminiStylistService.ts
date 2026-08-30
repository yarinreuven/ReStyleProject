import sharp from "sharp";
import mongoose from "mongoose";

import type { AnalyzedWardrobeItem } from "./geminiStylistValidationService.ts";
import {
  DETECTED_CATEGORIES,
  isDetectedCategory,
  type SelectedOutfitItem
} from "./outfitSelectionService.ts";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export const GEMINI_STYLIST_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_STYLIST_MAX_ITEMS = 14;
export const GEMINI_STYLIST_IMAGE_EDGE = 640;
export const GEMINI_STYLIST_JPEG_QUALITY = 65;
const GEMINI_STYLIST_MAX_REQUEST_BYTES = 18 * 1024 * 1024;
const GEMINI_STYLIST_TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

export function isNoCostAiMockMode() {
  return process.env.NODE_ENV !== "production" &&
    process.env.RESTYLE_AI_MOCK_MODE === "1";
}

export const GEMINI_STYLIST_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    explanation: { type: "STRING" },
    analyzedItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          itemId: { type: "STRING" },
          isValid: { type: "BOOLEAN" },
          detectedCategory: {
            type: "STRING",
            enum: [...DETECTED_CATEGORIES, "None"]
          },
          eventSuitable: { type: "BOOLEAN" },
          styleSuitable: { type: "BOOLEAN" },
          weatherSuitable: { type: "BOOLEAN" },
          visualDescription: { type: "STRING" }
        },
        required: [
          "itemId", "isValid", "detectedCategory", "eventSuitable",
          "styleSuitable", "weatherSuitable", "visualDescription"
        ]
      }
    },
    selectedItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          itemId: { type: "STRING" },
          detectedCategory: { type: "STRING", enum: [...DETECTED_CATEGORIES] },
          reason: { type: "STRING" }
        },
        required: ["itemId", "detectedCategory", "reason"]
      }
    },
    cohesion: {
      type: "OBJECT",
      properties: {
        colorsCoordinate: { type: "BOOLEAN" },
        formalityCoordinates: { type: "BOOLEAN" },
        silhouettesCoordinate: { type: "BOOLEAN" },
        occasionCoordinates: { type: "BOOLEAN" },
        reason: { type: "STRING" }
      },
      required: [
        "colorsCoordinate", "formalityCoordinates", "silhouettesCoordinate",
        "occasionCoordinates", "reason"
      ]
    },
    stylingTips: { type: "ARRAY", items: { type: "STRING" } },
    avatarValidation: {
      type: "OBJECT",
      properties: {
        valid: { type: "BOOLEAN" },
        singlePerson: { type: "BOOLEAN" },
        fullBodyVisible: { type: "BOOLEAN" },
        frontFacing: { type: "BOOLEAN" },
        faceClear: { type: "BOOLEAN" },
        reason: { type: "STRING" }
      },
      required: ["valid", "singlePerson", "fullBodyVisible", "frontFacing", "faceClear", "reason"]
    }
  },
  required: [
    "title", "explanation", "analyzedItems", "selectedItems", "cohesion", "stylingTips",
    "avatarValidation"
  ]
} as const;

export interface OutfitSuggestion {
  title: string;
  explanation: string;
  analyzedItems: AnalyzedWardrobeItem[];
  selectedItems: SelectedOutfitItem[];
  cohesion: {
    colorsCoordinate: boolean;
    formalityCoordinates: boolean;
    silhouettesCoordinate: boolean;
    occasionCoordinates: boolean;
    reason: string;
  };
  stylingTips: string[];
  avatarValidation: {
    valid: boolean;
    singlePerson: boolean;
    fullBodyVisible: boolean;
    frontFacing: boolean;
    faceClear: boolean;
    reason: string;
  };
}

export function isSafeStylistText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 &&
    !/(?:https?:\/\/|www\.|\bbuy\b|\bpurchase\b|\bshop\b)/i.test(value);
}

export function isValidStylistSelection(selection: SelectedOutfitItem) {
  return Boolean(
    selection &&
    typeof selection.itemId === "string" &&
    mongoose.isValidObjectId(selection.itemId) &&
    isDetectedCategory(selection.detectedCategory) &&
    isSafeStylistText(selection.reason)
  );
}

export function isCompleteStylistSuggestion(
  suggestion: OutfitSuggestion,
  expectedAnalyzedItems: number
) {
  return Boolean(
    suggestion &&
    isSafeStylistText(suggestion.title) &&
    isSafeStylistText(suggestion.explanation) &&
    Array.isArray(suggestion.stylingTips) &&
    suggestion.stylingTips.length >= 1 &&
    suggestion.stylingTips.length <= 3 &&
    suggestion.stylingTips.every(isSafeStylistText) &&
    suggestion.cohesion &&
    typeof suggestion.cohesion.colorsCoordinate === "boolean" &&
    typeof suggestion.cohesion.formalityCoordinates === "boolean" &&
    typeof suggestion.cohesion.silhouettesCoordinate === "boolean" &&
    typeof suggestion.cohesion.occasionCoordinates === "boolean" &&
    isSafeStylistText(suggestion.cohesion.reason) &&
    Array.isArray(suggestion.analyzedItems) &&
    suggestion.analyzedItems.length === expectedAnalyzedItems &&
    Array.isArray(suggestion.selectedItems)
  );
}

export function parseGeminiStylistSuggestion(
  outputText: string | undefined,
  expectedAnalyzedItems: number
):
  | { success: true; suggestion: OutfitSuggestion }
  | { success: false; reason: "missing" | "invalid-json" | "incomplete" } {
  if (!outputText) return { success: false, reason: "missing" };

  let suggestion: OutfitSuggestion;
  try {
    suggestion = JSON.parse(outputText) as OutfitSuggestion;
  } catch {
    return { success: false, reason: "invalid-json" };
  }

  if (!isCompleteStylistSuggestion(suggestion, expectedAnalyzedItems)) {
    return { success: false, reason: "incomplete" };
  }

  return { success: true, suggestion };
}

export function geminiStylistFailureMessage(httpStatus: number) {
  if (httpStatus === 429) {
    return "The AI styling allowance is temporarily busy or exhausted. Please check your Gemini quota and try again later.";
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return "Gemini access was rejected. Check that the Gemini API is enabled and that this API key is allowed to use it.";
  }
  if (httpStatus === 400 || httpStatus === 413) {
    return "The wardrobe image request was too large or was rejected by Gemini. Try with fewer or smaller wardrobe images.";
  }
  return "The wardrobe images could not be inspected right now. Please try again shortly.";
}

export async function buildGeminiWardrobeImageParts(items: Array<{
  id: string;
  item: {
    category: string;
    image?: { data?: Buffer };
  };
}>) {
  return (await Promise.all(items.map(async ({ item, id }) => {
    if (!item.image?.data) {
      throw new Error("GEMINI_STYLIST_IMAGE_MISSING");
    }

    const inspectionImage = await sharp(item.image.data)
      .rotate()
      .resize({
        width: GEMINI_STYLIST_IMAGE_EDGE,
        height: GEMINI_STYLIST_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: GEMINI_STYLIST_JPEG_QUALITY, mozjpeg: true })
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
}

export function buildGeminiStylistPrompt(
  request: Record<string, unknown>,
  wardrobe: Array<Record<string, unknown>>,
  avatarSource: "preset" | "personal"
) {
  return [
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
    avatarSource === "personal"
      ? "Validate the separately labeled PERSONAL MODEL PHOTO. Treat fullBodyVisible as true when exactly one person is clearly visible from the head through both knees, even when the lower legs or feet are outside the frame. The person should be approximately front-facing and their face identifiable. A natural arm position or mirror selfie is allowed; hands do not need to be beside the body. Reject face-only or upper-torso crops, photos cropped above the knees, strongly side-facing poses, a face substantially hidden by the phone, group photos, or a person too small or blurred to use."
      : "No personal model photo was requested. Return every avatarValidation boolean as true and reason as Preset avatar.",
    "Return one JSON object matching the provided response schema. The cohesion reason must briefly explain why the selected pieces work together. Keep stylingTips to between one and three short strings.",
    JSON.stringify({ request, wardrobe })
  ].join("\n");
}

export async function requestGeminiStylist(
  apiKey: string,
  requestBody: object
): Promise<{ response: Response; data: GeminiResponse; model: string }> {
  const serializedBody = JSON.stringify(requestBody);
  if (Buffer.byteLength(serializedBody, "utf8") > GEMINI_STYLIST_MAX_REQUEST_BYTES) {
    throw new Error("GEMINI_STYLIST_PAYLOAD_TOO_LARGE");
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STYLIST_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: serializedBody,
          signal: AbortSignal.timeout(90 * 1000)
        }
      );
      const data = await response.json() as GeminiResponse;
      if (response.ok || !GEMINI_STYLIST_TRANSIENT_STATUSES.has(response.status) || attempt === 2) {
        return { response, data, model: GEMINI_STYLIST_MODEL };
      }
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("GEMINI_STYLIST_RETRY_EXHAUSTED");
}
