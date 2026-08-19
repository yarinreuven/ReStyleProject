import { Client, handle_file } from "@gradio/client";
import sharp from "sharp";

const CAT_VTON_SPACE = "zhengchong/CatVTON";

let catVtonClientPromise: Promise<Client> | null = null;

type CatVtonClothType = "upper" | "lower" | "overall";

interface GradioImageResult {
  path?: string | null;
  url?: string | null;
  mime_type?: string | null;
}

function getHuggingFaceToken(): `hf_${string}` | undefined {
  const token = process.env.HF_TOKEN?.trim();

  if (!token) {
    return undefined;
  }

  if (!token.startsWith("hf_")) {
    throw new Error("HF_TOKEN must start with hf_");
  }

  return token as `hf_${string}`;
}

function getCatVtonClient() {
  if (!catVtonClientPromise) {
    const token = getHuggingFaceToken();
    catVtonClientPromise = Client.connect(
      CAT_VTON_SPACE,
      token ? { token } : undefined
    ).catch((error) => {
      catVtonClientPromise = null;
      throw error;
    });
  }

  return catVtonClientPromise;
}

function findImageResult(value: unknown): GradioImageResult | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findImageResult(entry);

      if (result) {
        return result;
      }
    }

    return null;
  }

  if (value && typeof value === "object") {
    const candidate = value as GradioImageResult;

    if (candidate.url || candidate.path) {
      return candidate;
    }
  }

  return null;
}

async function isSafetyPlaceholder(image: Buffer): Promise<boolean> {
  const { data, info } = await sharp(image)
    .resize(160, 160, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let brightPixels = 0;
  let orangePixels = 0;
  let orangeMinX = info.width;
  let orangeMaxX = -1;
  let orangeMinY = info.height;
  let orangeMaxY = -1;
  const pixelCount = info.width * info.height;

  for (let index = 0; index < data.length; index += info.channels) {
    const pixelIndex = index / info.channels;
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    if (red > 238 && green > 238 && blue > 238) {
      brightPixels += 1;
    }

    if (
      red > 180 &&
      green > 35 && green < 165 &&
      blue < 100 &&
      red > green * 1.35
    ) {
      orangePixels += 1;
      orangeMinX = Math.min(orangeMinX, x);
      orangeMaxX = Math.max(orangeMaxX, x);
      orangeMinY = Math.min(orangeMinY, y);
      orangeMaxY = Math.max(orangeMaxY, y);
    }
  }

  const orangeWidth = orangeMaxX - orangeMinX + 1;
  const orangeHeight = orangeMaxY - orangeMinY + 1;
  const orangeRatio = orangePixels / pixelCount;
  const orangeBoxAspect = orangeHeight > 0
    ? orangeWidth / orangeHeight
    : 0;

  return (
    brightPixels / pixelCount > 0.68 &&
    orangeRatio > 0.004 &&
    orangeRatio < 0.09 &&
    orangeBoxAspect > 1.35
  );
}

export async function createCatVtonImage(
  personImage: Buffer,
  garmentImage: Buffer,
  clothType: CatVtonClothType
): Promise<{ data: Buffer; contentType: string }> {
  const client = await getCatVtonClient();
  const [normalizedPerson, normalizedGarment, emptyMask] = await Promise.all([
    sharp(personImage)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(768, 1024, {
        fit: "contain",
        background: "#ffffff",
        withoutEnlargement: false
      })
      .jpeg({ quality: 92 })
      .toBuffer(),
    sharp(garmentImage)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(768, 1024, {
        fit: "contain",
        background: "#ffffff",
        withoutEnlargement: false
      })
      .jpeg({ quality: 92 })
      .toBuffer(),
    sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    }).png().toBuffer()
  ]);
  const personFile = handle_file(normalizedPerson);
  const maskFile = handle_file(emptyMask);
  const garmentFile = handle_file(normalizedGarment);
  const prediction = await client.predict("/submit_function", {
      person_image: {
        background: personFile,
        layers: [maskFile],
        composite: null
      },
      cloth_image: garmentFile,
      cloth_type: clothType,
      num_inference_steps: 30,
      guidance_scale: 2.5,
      seed: 42,
      show_type: "result only"
    });

    const generatedImage = findImageResult(prediction.data);
    const imageUrl = generatedImage?.url;

    if (!imageUrl) {
      throw new Error("CatVTON did not return a generated image URL");
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("Could not download the generated CatVTON image");
    }

    const contentType =
      imageResponse.headers.get("content-type") ||
      generatedImage?.mime_type ||
      "image/png";

  const resultData = Buffer.from(await imageResponse.arrayBuffer());

  if (await isSafetyPlaceholder(resultData)) {
    throw new Error("CatVTON returned an NSFW safety placeholder");
  }

  return {
    data: resultData,
    contentType
  };
}
