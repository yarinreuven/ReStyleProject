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
import type { AnalyzedWardrobeItem } from "./geminiStylistValidationService.ts";
import {
  DETECTED_CATEGORIES,
  type SelectedOutfitItem
} from "./outfitSelectionService.ts";
