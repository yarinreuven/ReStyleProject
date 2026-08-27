import sharp from "sharp";

import type { RestyleDetails, RestyleIdea } from "./restyleIdeaService.ts";

const RESTYLE_AI_MODEL = "gemini-3.1-flash-lite";
const RESTYLE_AI_TIMEOUT_MS = 15_000;
const RESTYLE_IMAGE_EDGE = 768;
const RESTYLE_IMAGE_QUALITY = 70;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

interface PersonalizedIdea {
  id: string;
  description: string;
  whyItFits: string;
}

interface GeminiRestyleResult {
  ideas?: PersonalizedIdea[];
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          description: { type: "STRING" },
          whyItFits: { type: "STRING" }
        },
        required: ["id", "description", "whyItFits"]
      }
    }
  },
  required: ["ideas"]
} as const;

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= 10 && normalized.length <= maxLength ? normalized : "";
}

async function optimizeGarmentImage(image?: { data?: Buffer; contentType?: string } | null) {
  if (!image?.data?.length || !image.contentType?.startsWith("image/")) return null;
  try {
    const data = await sharp(image.data)
      .rotate()
      .resize({
        width: RESTYLE_IMAGE_EDGE,
        height: RESTYLE_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: RESTYLE_IMAGE_QUALITY, mozjpeg: true })
      .toBuffer();
    return { data, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

function mergeVerifiedIdeas(candidates: RestyleIdea[], result: GeminiRestyleResult) {
  const byId = new Map(candidates.map((idea) => [idea.id, idea]));
  const seen = new Set<string>();
  const personalized: RestyleIdea[] = [];

  for (const entry of result.ideas || []) {
    const verified = byId.get(entry?.id);
    const description = safeText(entry?.description, 240);
    const whyItFits = safeText(entry?.whyItFits, 260);
    if (!verified || seen.has(verified.id) || !description || !whyItFits) continue;
    seen.add(verified.id);
    personalized.push({ ...verified, description, whyItFits });
  }

  return personalized.length > 0 ? personalized : candidates;
}

/**
 * Personalizes and ranks verified catalog ideas with Gemini. Any missing key,
 * quota error, timeout, invalid JSON or unsafe ID silently returns the curated
 * candidates so the user always receives a useful result.
 */
export async function personalizeRestyleIdeas(
  details: RestyleDetails,
  candidates: RestyleIdea[],
  image?: { data?: Buffer; contentType?: string } | null,
  fetcher: typeof fetch = fetch
) {
  const apiKey = process.env.GEMINI_RESTYLE_API_KEY?.trim();
  if (!apiKey || candidates.length === 0) return candidates;

  try {
    const optimizedImage = await optimizeGarmentImage(image);
    const candidateSummary = candidates.map((idea) => ({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      difficulty: idea.difficulty,
      outputType: idea.outputType,
      requiredTools: idea.requiredTools,
      materials: idea.materials
    }));
    const parts: object[] = [{
      text: [
        "You are a practical clothing upcycling assistant.",
        "Rank only the supplied verified ideas; never invent an ID, technique, tool or material.",
        "Return up to four ideas that are realistic for the garment details and visible condition.",
        "Personalize each description and whyItFits in clear, friendly English.",
        "Do not claim certainty about anything that is not clearly visible.",
        `Garment details: ${JSON.stringify(details)}`,
        `Verified candidates: ${JSON.stringify(candidateSummary)}`
      ].join("\n")
    }];
    if (optimizedImage) {
      parts.push({
        inline_data: {
          mime_type: optimizedImage.contentType,
          data: optimizedImage.data.toString("base64")
        }
      });
    }

    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${RESTYLE_AI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema
          }
        }),
        signal: AbortSignal.timeout(RESTYLE_AI_TIMEOUT_MS)
      }
    );
    if (!response.ok) return candidates;

    const data = await response.json() as GeminiResponse;
    const outputText = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    if (!outputText) return candidates;

    return mergeVerifiedIdeas(candidates, JSON.parse(outputText) as GeminiRestyleResult);
  } catch {
    return candidates;
  }
}
