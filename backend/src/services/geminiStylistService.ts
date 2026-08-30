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

export async function requestGeminiStylist(
  apiKey: string,
  requestBody: object
): Promise<{ response: Response; data: GeminiResponse; model: string }> {
  const serializedBody = JSON.stringify(requestBody);
  if (Buffer.byteLength(serializedBody, "utf8") > GEMINI_STYLIST_MAX_REQUEST_BYTES) {
    throw new Error("GEMINI_STYLIST_PAYLOAD_TOO_LARGE");
  }

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

  return { response, data, model: GEMINI_STYLIST_MODEL };
}
