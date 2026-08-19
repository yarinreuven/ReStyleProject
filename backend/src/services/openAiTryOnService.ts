interface OutfitImageInput {
  name: string;
  category: string;
  data: Buffer;
  contentType: string;
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

export async function createOpenAiTryOnImage(
  modelImage: Buffer,
  modelContentType: string,
  items: OutfitImageInput[]
): Promise<{ data: Buffer; contentType: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const inventory = items
    .map((item, index) => `${index + 1}. ${item.name} (${item.category})`)
    .join("\n");
  const prompt = [
    "Create a polished full-body virtual try-on fashion photograph.",
    "Image 1 is the exact model/avatar. Preserve its face, identity, body proportions, pose and background.",
    "Images 2 onward are exact selected wardrobe products. Dress the model in every referenced product and no other fashion product.",
    "Fit each garment naturally around the body with realistic fabric, seams, folds, sleeves, waist and hem.",
    "Keep the original color, pattern, material, silhouette and distinctive product details of every referenced wardrobe item.",
    "A dress replaces both top and bottom. Otherwise use exactly the referenced top and bottom.",
    "Put referenced shoes correctly on both feet. Place the referenced bag naturally in a hand or on a shoulder. Wear referenced accessories in their correct position.",
    "Show the entire body from head to both shoes. Do not show floating products, pasted rectangles, collages, product cards or labels.",
    "Do not invent clothing, shoes, bags, jewelry, belts, jackets, colors, prints, text, logos or watermarks.",
    "Selected wardrobe inventory:",
    inventory
  ].join("\n");
  const form = new FormData();

  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("quality", "medium");
  form.append("size", "1024x1536");
  form.append("output_format", "png");
  form.append(
    "image[]",
    new Blob([Uint8Array.from(modelImage)], { type: modelContentType }),
    "01-model.png"
  );

  items.forEach((item, index) => {
    form.append(
      "image[]",
      new Blob([Uint8Array.from(item.data)], { type: item.contentType }),
      `${String(index + 2).padStart(2, "0")}-${item.category}.png`
    );
  });

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(3 * 60 * 1000)
  });
  const result = await response.json() as OpenAiImageResponse;

  if (!response.ok) {
    throw new Error(
      `OpenAI image editing failed: ${result.error?.message || response.status}`
    );
  }

  const imageData = result.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error("OpenAI did not return a try-on image");
  }

  return { data: Buffer.from(imageData, "base64"), contentType: "image/png" };
}
