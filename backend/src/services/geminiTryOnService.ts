function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
}

interface OutfitImageInput {
  name: string;
  category: string;
  data: Buffer;
  contentType: string;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        thought?: boolean;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        inline_data?: {
          data?: string;
          mime_type?: string;
        };
      }>;
    };
  }>;
  error?: { message?: string };
}

export async function createGeminiTryOnImage(
  modelImage: Buffer,
  modelContentType: string,
  items: OutfitImageInput[]
): Promise<{ data: Buffer; contentType: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const imageModel = getGeminiImageModel();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const inventory = items
    .map((item, index) => `${index + 1}. ${item.name} (${item.category})`)
    .join("\n");
  const parts = [
    {
      text: [
        "Create one polished, full-body virtual try-on image.",
        "The first image is the model/avatar whose identity, face, body proportions, pose and background must remain recognizable.",
        "Every following image is an exact wardrobe reference selected by the stylist.",
        "Dress the model in ALL listed items and no unlisted fashion items.",
        "Preserve each product's exact color, silhouette, material, pattern and distinctive details as closely as possible.",
        "If the outfit has a dress, do not add a separate top or bottom. Otherwise show both the selected top and selected bottom.",
        "Shoes must be visible on the feet. Put the selected bag naturally in one hand or on one shoulder. Add selected accessories in their natural position.",
        "Keep the entire outfit visible from head to shoes. Use a clean fashion-catalog composition with realistic layering and fit.",
        "Do not invent jewelry, belts, jackets, bags, shoes, garments, prints or colors. Do not add text, labels or a watermark.",
        "Selected wardrobe inventory:",
        inventory
      ].join("\n")
    },
    {
      inline_data: {
        mime_type: modelContentType,
        data: modelImage.toString("base64")
      }
    },
    ...items.flatMap((item, index) => [
      {
        text: `${index + 1}. Exact reference for ${item.name} (${item.category}). This exact item must appear in the result.`
      },
      {
        inline_data: {
          mime_type: item.contentType,
          data: item.data.toString("base64")
        }
      }
    ])
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            image: {
              aspectRatio: "ASPECT_RATIO_THREE_BY_FOUR"
            }
          }
        }
      })
    }
  );
  const result = await response.json() as GeminiImageResponse;

  if (!response.ok) {
    throw new Error(
      `Gemini image generation failed: ${result.error?.message || response.status}`
    );
  }

  const outputPart = result.candidates?.[0]?.content?.parts?.find((part) => {
    if (part.thought) {
      return false;
    }

    return Boolean(part.inlineData?.data || part.inline_data?.data);
  });
  const imageData = outputPart?.inlineData?.data || outputPart?.inline_data?.data;
  const contentType =
    outputPart?.inlineData?.mimeType ||
    outputPart?.inline_data?.mime_type ||
    "image/png";

  if (!imageData) {
    throw new Error("Gemini did not return a final try-on image");
  }

  return { data: Buffer.from(imageData, "base64"), contentType };
}
