export const clothingCategories = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Jackets",
  "Shoes",
  "Bags",
  "Accessories"
] as const;

interface GeminiImageCheckResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

const TRANSIENT_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);
const IMAGE_CHECK_ATTEMPTS = 3;

export class WardrobeImageCheckUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Image verification is temporarily unavailable. Please try again in a moment.");
    this.name = "WardrobeImageCheckUnavailableError";
  }
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 300 * attempt));
}

export interface ImageCheckResult {
  isWardrobeItem: boolean;
  isSingleClearItem: boolean;
  category: typeof clothingCategories[number] | "None";
}

export async function checkWardrobeImage(
  file: Express.Multer.File
): Promise<ImageCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const requestBody = JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        {
          text:
            "Inspect this image strictly for a virtual wardrobe. Accept either (1) one clear clothing product shown by itself, or (2) one person wearing the intended product when that product is clearly visible and its color, cut, shape and design can be identified reliably. A matching pair of shoes counts as one product. Normal accompanying clothes on the same person are allowed only when the intended product is unambiguous. Tops include T-shirts, shirts, blouses, sweatshirts and ordinary sweaters regardless of sleeve length or oversized fit. Dresses must be one-piece garments intended to cover both the torso and lower body; never classify a long or oversized T-shirt as a dress. Use Jackets only for outerwear worn as a layer over an outfit, such as jackets, coats, blazers, trench coats and substantial outer cardigans. Reject wardrobe or closet scenes, clothing racks, piles, collages, screenshots, groups of people, distant subjects, unrelated objects, full-outfit photos where no single intended product is clear, and images in which the intended product is cropped, hidden, blurred or too small. Return the single best category and whether one intended wearable product is clear enough to use."
        },
        {
          inline_data: {
            mime_type: file.mimetype,
            data: file.buffer.toString("base64")
          }
        }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          isWardrobeItem: { type: "BOOLEAN" },
          isSingleClearItem: { type: "BOOLEAN" },
          category: { type: "STRING", enum: [...clothingCategories, "None"] }
        },
        required: ["isWardrobeItem", "isSingleClearItem", "category"]
      }
    }
  });

  for (let attempt = 1; attempt <= IMAGE_CHECK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
          body: requestBody,
          signal: AbortSignal.timeout(45 * 1000)
        }
      );
      const data = await response.json() as GeminiImageCheckResponse;
      if (response.ok) {
        const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!outputText) throw new WardrobeImageCheckUnavailableError();
        return JSON.parse(outputText) as ImageCheckResult;
      }
      console.error("Gemini image check error:", data.error?.message);
      if (!TRANSIENT_GEMINI_STATUSES.has(response.status)) {
        throw new WardrobeImageCheckUnavailableError();
      }
    } catch (error) {
      if (error instanceof WardrobeImageCheckUnavailableError) throw error;
      if (attempt === IMAGE_CHECK_ATTEMPTS) {
        throw new WardrobeImageCheckUnavailableError();
      }
    }
    if (attempt < IMAGE_CHECK_ATTEMPTS) await retryDelay(attempt);
  }
  throw new WardrobeImageCheckUnavailableError();
}

export async function validateWardrobeImage(
  file: Express.Multer.File,
  selectedCategory: string
) {
  const imageCheck = await checkWardrobeImage(file);

  if (!imageCheck.isWardrobeItem || !imageCheck.isSingleClearItem || imageCheck.category === "None") {
    return {
      valid: false,
      detectedCategory: null,
      message: "Please upload a clear photo of the item by itself or clearly worn by one person. Avoid screenshots, closets, collages, groups and unclear full-outfit photos"
    };
  }

  if (imageCheck.category !== selectedCategory) {
    return {
      valid: false,
      detectedCategory: imageCheck.category,
      message: `This image looks like ${imageCheck.category}. Please choose the matching category.`
    };
  }

  return { valid: true, detectedCategory: imageCheck.category, message: "" };
}
