import sharp, { type Metadata } from "sharp";

import type { DetectedCategory } from "./outfitSelectionService.ts";
import type { TryOnQualityResult } from "./tryOnValidationService.ts";

export const GEMINI_TRY_ON_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
export const GEMINI_TRY_ON_QUALITY_MODEL = "gemini-3.1-flash-lite";

export interface OutfitImageInput {
  itemId: string;
  name: string;
  detectedCategory: DetectedCategory;
  data: Buffer;
  contentType: string;
}

interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiResponsePart[] } }>;
  error?: { message?: string };
}

export function extractGeminiImagePayload(result: GeminiResponse) {
  const outputPart = result.candidates?.[0]?.content?.parts?.find((part) =>
    !part.thought && Boolean(part.inlineData?.data || part.inline_data?.data)
  );
  const imageData = outputPart?.inlineData?.data || outputPart?.inline_data?.data;
  const contentType = outputPart?.inlineData?.mimeType || outputPart?.inline_data?.mime_type;
  return imageData && contentType ? { imageData, contentType } : null;
}

function apiKey() {
  const value = process.env.GEMINI_API_KEY?.trim();
  if (!value) throw new Error("GEMINI_API_KEY is missing");
  return value;
}

function inlineImage(data: Buffer, contentType: string) {
  return {
    inline_data: {
      mime_type: contentType,
      data: data.toString("base64")
    }
  };
}

async function assertValidReturnedImage(data: Buffer, contentType: string) {
  const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const formatToMimeType: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  if (!supportedMimeTypes.has(contentType) || data.length === 0) {
    throw new Error("Gemini returned an unsupported or empty try-on image");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(data).metadata();
  } catch {
    throw new Error("Gemini returned a damaged try-on image");
  }
  const detectedMimeType = metadata.format ? formatToMimeType[metadata.format] : undefined;
  if (!detectedMimeType || detectedMimeType !== contentType ||
    !metadata.width || !metadata.height) {
    throw new Error("Gemini returned an invalid try-on image format");
  }
}

export async function createGeminiTryOnImage(
  avatarImage: Buffer,
  avatarContentType: string,
  items: OutfitImageInput[]
): Promise<{ data: Buffer; contentType: string }> {
  const inventory = items
    .map((item, index) =>
      `${index + 1}. itemId=${item.itemId}; detectedCategory=${item.detectedCategory}; name=${item.name}`
    )
    .join("\n");
  const instructions = [
    "Create exactly one polished vertical 1K full-body virtual try-on image.",
    "The labeled PERSON/AVATAR reference is the identity source. Preserve the face, identity, skin tone, hair, body structure, proportions and pose as closely as possible.",
    "For an illustrated avatar, preserve the illustration style and character identity. For a real person, preserve their real appearance and do not redesign the face.",
    "Keep the head, both hands, full body, both legs and both shoes completely inside the frame.",
    "Use every selected wardrobe reference and no unselected fashion item.",
    "Preserve each selected item's color, print, fabric, cut, length and distinctive details.",
    "A Dress replaces Top and Bottom. Otherwise both the Top and Bottom must be visible and no dress may be added.",
    "A Jacket must be the outermost clothing layer. Shoes must be worn on both feet and fully visible.",
    "Place the selected Bag naturally in a hand or on a shoulder. Place the selected Accessory in its natural location.",
    "Use a clean background that does not hide the outfit.",
    "Do not add text, logos, watermark, collage, product cards, jewelry, belts, bags, shoes, garments or accessories that were not provided.",
    "Selected wardrobe inventory:",
    inventory
  ].join("\n");
  const parts = [
    { text: instructions },
    { text: "PERSON/AVATAR REFERENCE. Preserve this identity and show the complete body." },
    inlineImage(avatarImage, avatarContentType),
    ...items.flatMap((item) => [
      {
        text: `WARDROBE REFERENCE itemId=${item.itemId}; detectedCategory=${item.detectedCategory}. This exact selected item must appear.`
      },
      inlineImage(item.data, item.contentType)
    ])
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRY_ON_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            image: {
              aspectRatio: "3:4",
              imageSize: "1K"
            }
          }
        }
      }),
      signal: AbortSignal.timeout(3 * 60 * 1000)
    }
  );
  const result = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw new Error(`Gemini image generation failed: ${result.error?.message || response.status}`);
  }

  const imagePayload = extractGeminiImagePayload(result);
  if (!imagePayload) throw new Error("Gemini did not return a final try-on image");

  const data = Buffer.from(imagePayload.imageData, "base64");
  await assertValidReturnedImage(data, imagePayload.contentType);
  return { data, contentType: imagePayload.contentType };
}

export async function validateGeminiTryOnImage(
  generatedImage: Buffer,
  generatedContentType: string,
  avatarImage: Buffer,
  avatarContentType: string,
  items: OutfitImageInput[]
): Promise<TryOnQualityResult> {
  const categories = items.map((item) => item.detectedCategory);
  const parts = [
    {
      text: [
        "Validate the generated virtual try-on conservatively.",
        "Image 1 is the original person/avatar. Image 2 is the generated try-on. Remaining images are the exact selected wardrobe references.",
        "Confirm the full body and shoes are inside the frame, identity and face are preserved, the required Dress or Top+Bottom base is present, every selected optional category is visible, and no unselected fashion item was added.",
        `Selected categories: ${categories.join(", ")}.`,
        "Return only the requested structured JSON. Do not use external information."
      ].join("\n")
    },
    { text: "IMAGE 1: ORIGINAL PERSON/AVATAR" },
    inlineImage(avatarImage, avatarContentType),
    { text: "IMAGE 2: GENERATED TRY-ON TO VALIDATE" },
    inlineImage(generatedImage, generatedContentType),
    ...items.flatMap((item) => [
      { text: `SELECTED REFERENCE itemId=${item.itemId}; detectedCategory=${item.detectedCategory}` },
      inlineImage(item.data, item.contentType)
    ])
  ];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRY_ON_QUALITY_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              valid: { type: "BOOLEAN" },
              fullBodyVisible: { type: "BOOLEAN" },
              facePreserved: { type: "BOOLEAN" },
              baseOutfitPresent: { type: "BOOLEAN" },
              jacketPresent: { type: "BOOLEAN" },
              shoesPresent: { type: "BOOLEAN" },
              bagPresent: { type: "BOOLEAN" },
              accessoryPresent: { type: "BOOLEAN" },
              unexpectedItemsDetected: { type: "BOOLEAN" },
              failureReasons: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: [
              "valid", "fullBodyVisible", "facePreserved", "baseOutfitPresent",
              "jacketPresent", "shoesPresent", "bagPresent", "accessoryPresent",
              "unexpectedItemsDetected", "failureReasons"
            ]
          }
        }
      }),
      signal: AbortSignal.timeout(90 * 1000)
    }
  );
  const result = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw new Error(`Gemini try-on validation failed: ${result.error?.message || response.status}`);
  }
  const text = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new Error("Gemini try-on validation returned no result");
  try {
    return JSON.parse(text) as TryOnQualityResult;
  } catch {
    throw new Error("Gemini try-on validation returned invalid JSON");
  }
}
