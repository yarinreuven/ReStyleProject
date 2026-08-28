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

export interface RestyleImageValidation {
  eligible: boolean;
  detectedType: "Tops" | "Bottoms" | "Dresses" | "Skirts" | "Jackets" | "Shirts" | "Sweaters" | "unsupported";
}

const imageValidationSchema = {
  type: "OBJECT",
  properties: {
    eligible: { type: "BOOLEAN" },
    detectedType: {
      type: "STRING",
      enum: ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters", "unsupported"]
    }
  },
  required: ["eligible", "detectedType"]
} as const;

interface GeneratedRestyleResult {
  idea?: {
    title?: string;
    description?: string;
    difficulty?: "Easy" | "Medium" | "Challenging";
    outputType?: "clothing" | "bag" | "accessory" | "home";
    timeMinutes?: number;
    sewingRequired?: boolean;
    requiredTools?: string[];
    materials?: string[];
    whyItFits?: string;
    steps?: Array<{ title?: string; instruction?: string }>;
    tips?: string[];
    warnings?: string[];
    youtubeSearchQuery?: string;
  };
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

const generatedIdeaSchema = {
  type: "OBJECT",
  properties: {
    idea: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" }, description: { type: "STRING" },
        difficulty: { type: "STRING", enum: ["Easy", "Medium", "Challenging"] },
        outputType: { type: "STRING", enum: ["clothing", "bag", "accessory", "home"] },
        timeMinutes: { type: "INTEGER", minimum: 15, maximum: 360 },
        sewingRequired: { type: "BOOLEAN" },
        requiredTools: { type: "ARRAY", items: { type: "STRING" }, maxItems: 6 },
        materials: { type: "ARRAY", items: { type: "STRING" }, maxItems: 8 },
        whyItFits: { type: "STRING" },
        steps: { type: "ARRAY", minItems: 5, maxItems: 5, items: { type: "OBJECT", properties: { title: { type: "STRING" }, instruction: { type: "STRING" } }, required: ["title", "instruction"] } },
        tips: { type: "ARRAY", minItems: 1, maxItems: 4, items: { type: "STRING" } },
        warnings: { type: "ARRAY", minItems: 1, maxItems: 4, items: { type: "STRING" } },
        youtubeSearchQuery: { type: "STRING" }
      },
      required: ["title", "description", "difficulty", "outputType", "timeMinutes", "sewingRequired", "requiredTools", "materials", "whyItFits", "steps", "tips", "warnings", "youtubeSearchQuery"]
    }
  }, required: ["idea"]
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

export async function validateRestyleGarmentImage(
  image: { data?: Buffer; contentType?: string } | null,
  fetcher: typeof fetch = fetch
): Promise<RestyleImageValidation | null> {
  const apiKey = process.env.GEMINI_RESTYLE_API_KEY?.trim();
  if (!apiKey) return null;
  const optimizedImage = await optimizeGarmentImage(image);
  if (!optimizedImage) return { eligible: false, detectedType: "unsupported" };
  try {
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${RESTYLE_AI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: "Classify the main item in this image. ReStyle Studio accepts clothing garments only. Shoes, bags, jewelry, belts, hats, people without a clearly isolated garment, furniture, and other objects are unsupported. Set eligible=false and detectedType=unsupported for them. Do not guess when the item is unclear." },
            { inline_data: { mime_type: optimizedImage.contentType, data: optimizedImage.data.toString("base64") } }
          ] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 100,
            responseMimeType: "application/json",
            responseSchema: imageValidationSchema
          }
        }),
        signal: AbortSignal.timeout(RESTYLE_AI_TIMEOUT_MS)
      }
    );
    if (!response.ok) return null;
    const data = await response.json() as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!raw) return null;
    const result = JSON.parse(raw) as RestyleImageValidation;
    const allowed = new Set(["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters"]);
    if (!result.eligible || !allowed.has(result.detectedType)) return { eligible: false, detectedType: "unsupported" };
    return result;
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

const difficultyRank = { Easy: 1, Medium: 2, Challenging: 3 } as const;

/** Creates one constrained fallback guide only when the verified catalog has no match. */
export async function generateRestyleFallbackIdea(
  details: RestyleDetails,
  image?: { data?: Buffer; contentType?: string } | null,
  fetcher: typeof fetch = fetch
) {
  const apiKey = process.env.GEMINI_RESTYLE_API_KEY?.trim();
  if (!apiKey) return [];
  try {
    const optimizedImage = await optimizeGarmentImage(image);
    const parts: object[] = [{ text: [
      "Create exactly one conservative clothing-upcycling project because the verified catalog had no match.",
      "Use only tools explicitly listed by the user. Respect sewing skill and requested difficulty.",
      "Prefer reversible, low-risk, useful everyday projects. Never suggest fire, harsh chemicals, structural protective gear, or techniques requiring unlisted power tools.",
      "Give exactly five actionable steps. Include honest safety warnings. Do not invent a video URL; provide only a concise YouTube search query.",
      "Write clear friendly English and do not claim certainty about details that are not visible.",
      `Garment details: ${JSON.stringify(details)}`
    ].join("\n") }];
    if (optimizedImage) parts.push({ inline_data: { mime_type: optimizedImage.contentType, data: optimizedImage.data.toString("base64") } });
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${RESTYLE_AI_MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.25, maxOutputTokens: 1800, responseMimeType: "application/json", responseSchema: generatedIdeaSchema } }),
      signal: AbortSignal.timeout(RESTYLE_AI_TIMEOUT_MS)
    });
    if (!response.ok) return [];
    const data = await response.json() as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!raw) return [];
    const generated = (JSON.parse(raw) as GeneratedRestyleResult).idea;
    if (!generated) return [];
    const title = safeText(generated.title, 90);
    const description = safeText(generated.description, 240);
    const whyItFits = safeText(generated.whyItFits, 260);
    const allowedTools = new Set(details.tools);
    const requiredTools = Array.isArray(generated.requiredTools) ? generated.requiredTools.filter((tool) => typeof tool === "string") : [];
    const steps = Array.isArray(generated.steps) ? generated.steps.map((step, index) => ({ id: `ai-step-${index + 1}`, title: safeText(step.title, 90), instruction: safeText(step.instruction, 360) })) : [];
    const userDifficulty = difficultyRank[details.difficulty as keyof typeof difficultyRank] || 0;
    const ideaDifficulty = generated.difficulty ? difficultyRank[generated.difficulty] : 99;
    if (!title || !description || !whyItFits || steps.length !== 5 || steps.some((step) => !step.title || !step.instruction)) return [];
    if (requiredTools.some((tool) => !allowedTools.has(tool)) || ideaDifficulty > userDifficulty) return [];
    if (generated.sewingRequired && details.sewingSkill === "No sewing") return [];
    const query = safeText(generated.youtubeSearchQuery, 120);
    const id = `ai-${Date.now().toString(36)}`;
    return [{
      id, title, description, difficulty: generated.difficulty!, outputType: generated.outputType!,
      timeMinutes: Math.round(Number(generated.timeMinutes)), sewingRequired: Boolean(generated.sewingRequired), requiredTools,
      materials: (generated.materials || []).filter((value): value is string => typeof value === "string").slice(0, 8),
      suitableConditions: [details.condition], icon: "wand-magic-sparkles", whyItFits, matchScore: 78, matchLabel: "Good match" as const,
      generatedGuide: {
        steps,
        tips: (generated.tips || []).filter((value): value is string => Boolean(safeText(value, 220))).slice(0, 4),
        warnings: (generated.warnings || []).filter((value): value is string => Boolean(safeText(value, 240))).slice(0, 4),
        verifiedVideo: null,
        videoSearch: query ? { title: "Find a matching YouTube tutorial", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` } : undefined
      }
    }];
  } catch {
    return [];
  }
}
