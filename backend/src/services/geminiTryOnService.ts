import sharp, { type Metadata } from "sharp";

import type { DetectedCategory } from "./outfitSelectionService.ts";
import type { TryOnQualityResult } from "./tryOnValidationService.ts";

export const GEMINI_TRY_ON_IMAGE_MODEL = "gemini-3.1-flash-image";
export const GEMINI_TRY_ON_IMAGE_FALLBACK_MODEL = "gemini-3.1-flash-lite-image";
export const GEMINI_TRY_ON_QUALITY_MODEL = "gemini-3.1-flash-lite";

export interface OutfitImageInput {
  itemId: string;
  name: string;
  detectedCategory: DetectedCategory;
  visualDescription?: string;
  requiredGarmentType?: string;
  data: Buffer;
  contentType: string;
}

const GARMENT_TYPE_TERMS = [
  { type: "skirt", terms: ["חצאית", "skirt"] },
  { type: "jeans", terms: ["ג'ינס", "ג׳ינס", "גינס", "jeans", "denim pants"] },
  { type: "shorts", terms: ["מכנסיים קצרים", "מכנס קצר", "shorts"] },
  { type: "trousers", terms: ["מכנסיים", "מכנס", "trousers", "pants"] }
] as const;

const LONG_SKIRT_TERMS = [
  "חצאית ארוכה", "חצאית מידי", "חצאית מקסי",
  "long skirt", "midi skirt", "maxi skirt", "ankle-length skirt", "below-knee skirt"
] as const;

export function inferRequiredGarmentType(
  name: string,
  detectedCategory: DetectedCategory,
  visualDescription = ""
) {
  if (detectedCategory !== "Bottom") return detectedCategory.toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  const normalizedDescription = visualDescription.trim().toLowerCase();

  if ([...LONG_SKIRT_TERMS].some((term) =>
    normalizedName.includes(term) || normalizedDescription.includes(term)
  )) {
    return "long skirt with the reference hemline at or below the knee";
  }

  for (const candidate of GARMENT_TYPE_TERMS) {
    if (candidate.terms.some((term) => normalizedName.includes(term))) {
      return candidate.type;
    }
  }
  for (const candidate of GARMENT_TYPE_TERMS) {
    if (candidate.terms.some((term) => normalizedDescription.includes(term))) {
      return candidate.type;
    }
  }
  return "bottom garment shown in the reference";
}

export function reconcileGarmentVisualDescription(
  name: string,
  detectedCategory: DetectedCategory,
  visualDescription = ""
) {
  const requiredType = inferRequiredGarmentType(name, detectedCategory, visualDescription);
  const description = visualDescription.toLowerCase();
  const describesPants = ["jeans", "trousers", "pants", "shorts", "מכנס"]
    .some((term) => description.includes(term));
  if (requiredType.includes("skirt") && describesPants) {
    return "Skirt shown in the wardrobe reference. Ignore any conflicting pants or jeans interpretation. Preserve the exact skirt silhouette, denim material, color and reference hem length.";
  }
  return visualDescription;
}

interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiResponsePart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export class GeminiTryOnServiceError extends Error {
  constructor(
    public readonly stage: "generation" | "validation",
    public readonly code: string,
    public readonly httpStatus?: number,
    public readonly providerStatus?: string
  ) {
    super(code);
    this.name = "GeminiTryOnServiceError";
  }
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

export function buildTryOnGenerationParts(
  avatarImage: Buffer,
  avatarContentType: string,
  items: OutfitImageInput[]
) {
  const normalizedItems = items.map((item) => ({
    ...item,
    visualDescription: reconcileGarmentVisualDescription(
      item.name,
      item.detectedCategory,
      item.visualDescription
    )
  }));
  const selectedCategories = new Set(normalizedItems.map((item) => item.detectedCategory));
  const optionalCategoryRules = [
    ["Jacket", "NO JACKET OR OUTERWEAR"],
    ["Bag", "NO BAG"],
    ["Accessory", "NO ACCESSORY OR JEWELRY"],
    ["Shoes", "NO ADDED SHOES"]
  ] as const;
  const forbiddenCategories = optionalCategoryRules
    .filter(([category]) => !selectedCategories.has(category))
    .map(([, rule]) => rule)
    .join("; ");
  const inventory = normalizedItems
    .map((item, index) =>
      `${index + 1}. itemId=${item.itemId}; detectedCategory=${item.detectedCategory}; REQUIRED_GARMENT_TYPE=${item.requiredGarmentType || inferRequiredGarmentType(item.name, item.detectedCategory, item.visualDescription)}; name=${item.name}; exactVisualGarment=${item.visualDescription || "follow the reference image exactly"}`
    )
    .join("\n");
  const instructions = [
    "Perform a localized clothing edit on the PERSON/AVATAR reference and return exactly one polished vertical 1K full-body virtual try-on image.",
    "IDENTITY LOCK: the PERSON/AVATAR reference is the only identity source. Keep the original person's exact facial identity, facial geometry, eyes, eyebrows, nose, lips, jaw, skin tone, hairline and distinguishing features.",
    "Do not beautify, retouch, age, de-age, stylize, reinterpret, regenerate or replace the face. Do not substitute a similar-looking person. The result must remain recognizably the exact same person.",
    "Treat the head and face as protected content: edit clothing only below the neck. Preserve the original head, face, hair, expression and gaze unchanged whenever technically possible.",
    "For an illustrated avatar, preserve the illustration style and character identity. For a real person, preserve their real photographic appearance.",
    "The PERSON/AVATAR reference supplies identity and body only. Its original clothes, shoes, bag, jewelry and accessories are NOT wardrobe references and must not survive into the result.",
    "Remove or fully replace every visible original garment and fashion item from the PERSON/AVATAR image. Dress the person exclusively in the selected WARDROBE REFERENCES listed below.",
    "BACKGROUND REPLACEMENT: use the PERSON/AVATAR image only for the person—their face, hair, body, proportions and pose. The original background is not reference content and must not appear in the result.",
    "Completely remove and replace the source background with a plain, clean, softly lit neutral studio background in white, light gray or warm off-white.",
    "Do not copy or recreate any source scenery, plants, furniture, walls, floor details, people, objects, shadows or environmental elements. Keep only the person from the source image.",
    "Keep the head, both hands, full body, both legs and both shoes completely inside the frame.",
    "Use every selected wardrobe reference and no unselected fashion item.",
    `STRICT CATEGORY ALLOWLIST: ${[...selectedCategories].join(", ")}. No other fashion category may appear.`,
    `STRICT ABSENCE RULES: ${forbiddenCategories || "none"}. These absences are mandatory even if such an item appears in the original person photo.`,
    "GARMENT LOCK: copy the garment type and silhouette from every wardrobe reference exactly. Preserve its color, print, fabric, cut, waist, leg or hem shape, length and distinctive details.",
    "Never change one garment subtype into another: a skirt must remain a skirt and must never become jeans, trousers or shorts; trousers must remain trousers; jeans must remain jeans; shorts must remain shorts; a dress must remain a dress.",
    "REQUIRED_GARMENT_TYPE is a hard constraint and overrides the broad detectedCategory and any conflicting interpretation. If REQUIRED_GARMENT_TYPE=skirt, the legs must be covered by one connected skirt silhouette with a visible skirt hem and no trouser legs, inseams or jeans construction.",
    "SKIRT LENGTH LOCK: inspect the skirt reference hem position relative to the model. Reproduce that exact hem length. A midi, maxi, long or below-knee skirt must remain at or below the knee and must never be shortened into a mini skirt. Generate a mini skirt only when the wardrobe reference is unmistakably above the knee.",
    "A Dress replaces Top and Bottom. Otherwise both the Top and Bottom must be visible and no dress may be added.",
    "A Jacket must be the outermost clothing layer. Shoes must be worn on both feet and fully visible.",
    "If Jacket is not in the selected inventory, the finished person must have no jacket, coat, blazer, cardigan, vest or any other outerwear layer. The selected base garment must remain visibly unobstructed.",
    "Place the selected Bag naturally in a hand or on a shoulder. Place the selected Accessory in its natural location.",
    "The final background must be uncluttered and must clearly separate the full-body person and outfit.",
    "Do not add text, logos, watermark, collage, product cards, jewelry, belts, bags, shoes, garments or accessories that were not provided.",
    "Selected wardrobe inventory:",
    inventory
  ].join("\n");
  return [
    { text: instructions },
    { text: "PERSON/AVATAR REFERENCE. Preserve this identity and show the complete body." },
    inlineImage(avatarImage, avatarContentType),
    ...normalizedItems.flatMap((item) => [
      {
        text: `WARDROBE REFERENCE itemId=${item.itemId}; detectedCategory=${item.detectedCategory}; REQUIRED_GARMENT_TYPE=${item.requiredGarmentType || inferRequiredGarmentType(item.name, item.detectedCategory, item.visualDescription)}; exactVisualGarment=${item.visualDescription || "inspect this reference precisely"}. REQUIRED_GARMENT_TYPE is mandatory. This exact selected garment type, silhouette, length, material and color must appear without substitution.`
      },
      inlineImage(item.data, item.contentType)
    ])
  ];
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
  items: OutfitImageInput[],
  fetchImpl: typeof fetch = fetch
): Promise<{ data: Buffer; contentType: string; model: string }> {
  const parts = buildTryOnGenerationParts(avatarImage, avatarContentType, items);

  const request = async (model: string) => {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"] }
        }),
        signal: AbortSignal.timeout(3 * 60 * 1000)
      }
    );
    const result = await response.json() as GeminiResponse;
    if (!response.ok) {
      throw new GeminiTryOnServiceError(
        "generation",
        "PROVIDER_REQUEST_REJECTED",
        response.status,
        result.error?.status
      );
    }

    const imagePayload = extractGeminiImagePayload(result);
    if (!imagePayload) {
      throw new GeminiTryOnServiceError(
        "generation",
        result.promptFeedback?.blockReason ? "PROMPT_BLOCKED" : "NO_FINAL_IMAGE",
        response.status,
        result.promptFeedback?.blockReason || result.candidates?.[0]?.finishReason
      );
    }

    const data = Buffer.from(imagePayload.imageData, "base64");
    await assertValidReturnedImage(data, imagePayload.contentType);
    return { data, contentType: imagePayload.contentType, model };
  };

  try {
    return await request(GEMINI_TRY_ON_IMAGE_MODEL);
  } catch (error) {
    if (!(error instanceof GeminiTryOnServiceError) || error.httpStatus !== 429) throw error;
    return request(GEMINI_TRY_ON_IMAGE_FALLBACK_MODEL);
  }
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
        "Compare every generated garment against its wardrobe reference. exactGarmentsMatchReferences may be true only when every garment has the same subtype, silhouette, color and length. A skirt rendered as jeans, trousers or shorts is always false. A midi, maxi or long skirt shortened above the knee is always false.",
        `Selected categories: ${categories.join(", ")}.`,
        "Return only the requested structured JSON. Do not use external information."
      ].join("\n")
    },
    { text: "IMAGE 1: ORIGINAL PERSON/AVATAR" },
    inlineImage(avatarImage, avatarContentType),
    { text: "IMAGE 2: GENERATED TRY-ON TO VALIDATE" },
    inlineImage(generatedImage, generatedContentType),
    ...items.flatMap((item) => [
      {
        text: `SELECTED REFERENCE itemId=${item.itemId}; detectedCategory=${item.detectedCategory}; REQUIRED_GARMENT_TYPE=${item.requiredGarmentType || inferRequiredGarmentType(item.name, item.detectedCategory, item.visualDescription)}; exactVisualGarment=${reconcileGarmentVisualDescription(item.name, item.detectedCategory, item.visualDescription) || "inspect this reference precisely"}`
      },
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
              exactGarmentsMatchReferences: { type: "BOOLEAN" },
              jacketPresent: { type: "BOOLEAN" },
              shoesPresent: { type: "BOOLEAN" },
              bagPresent: { type: "BOOLEAN" },
              accessoryPresent: { type: "BOOLEAN" },
              unexpectedItemsDetected: { type: "BOOLEAN" },
              failureReasons: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: [
              "valid", "fullBodyVisible", "facePreserved", "baseOutfitPresent", "exactGarmentsMatchReferences",
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
    throw new GeminiTryOnServiceError(
      "validation",
      "PROVIDER_REQUEST_REJECTED",
      response.status,
      result.error?.status
    );
  }
  const text = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) {
    throw new GeminiTryOnServiceError(
      "validation",
      result.promptFeedback?.blockReason ? "PROMPT_BLOCKED" : "NO_VALIDATION_RESULT",
      response.status,
      result.promptFeedback?.blockReason || result.candidates?.[0]?.finishReason
    );
  }
  try {
    return JSON.parse(text) as TryOnQualityResult;
  } catch {
    throw new GeminiTryOnServiceError("validation", "INVALID_VALIDATION_JSON");
  }
}
