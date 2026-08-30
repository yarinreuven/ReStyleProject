import {
  isDetectedCategory,
  type DetectedCategory,
  type SelectedOutfitItem
} from "./outfitSelectionService.ts";

export interface AnalyzedWardrobeItem {
  itemId: string;
  isValid: boolean;
  detectedCategory: DetectedCategory | "None";
  eventSuitable: boolean;
  styleSuitable: boolean;
  weatherSuitable: boolean;
  visualDescription: string;
}

interface AvatarValidationResult {
  singlePerson?: unknown;
  fullBodyVisible?: unknown;
  frontFacing?: unknown;
}

export function isPersonalAvatarAcceptable(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const validation = value as AvatarValidationResult;
  return validation.singlePerson === true &&
    validation.fullBodyVisible === true &&
    validation.frontFacing === true;
}

const NORMALIZED_CATEGORIES = new Map<string, DetectedCategory | "None">([
  ["dress", "Dress"],
  ["dresses", "Dress"],
  ["top", "Top"],
  ["tops", "Top"],
  ["bottom", "Bottom"],
  ["bottoms", "Bottom"],
  ["jacket", "Jacket"],
  ["jackets", "Jacket"],
  ["shoe", "Shoes"],
  ["shoes", "Shoes"],
  ["bag", "Bag"],
  ["bags", "Bag"],
  ["accessory", "Accessory"],
  ["accessories", "Accessory"],
  ["none", "None"]
]);

export function normalizeGeminiCategory(value: unknown) {
  if (isDetectedCategory(value) || value === "None") return value;
  return typeof value === "string"
    ? NORMALIZED_CATEGORIES.get(value.trim().toLowerCase()) || null
    : null;
}

/**
 * Normalizes harmless Gemini formatting variations while keeping identity,
 * ownership-sensitive IDs and valid-item classifications strict.
 */
export function normalizeAnalyzedWardrobeItem(
  value: unknown,
  candidateIds: Set<string>
): AnalyzedWardrobeItem | null {
  if (!value || typeof value !== "object") return null;
  const analysis = value as Record<string, unknown>;
  const detectedCategory = normalizeGeminiCategory(analysis.detectedCategory);

  if (typeof analysis.itemId !== "string" || !candidateIds.has(analysis.itemId) ||
    typeof analysis.isValid !== "boolean") {
    return null;
  }

  if (!analysis.isValid) {
    if (detectedCategory !== "None") return null;

    return {
      itemId: analysis.itemId,
      isValid: false,
      detectedCategory: "None",
      eventSuitable: false,
      styleSuitable: false,
      weatherSuitable: false,
      visualDescription: ""
    };
  }

  if (!isDetectedCategory(detectedCategory) ||
    typeof analysis.eventSuitable !== "boolean" ||
    typeof analysis.styleSuitable !== "boolean" ||
    typeof analysis.weatherSuitable !== "boolean") {
    return null;
  }

  return {
    itemId: analysis.itemId,
    isValid: true,
    detectedCategory,
    eventSuitable: analysis.eventSuitable,
    styleSuitable: analysis.styleSuitable,
    weatherSuitable: analysis.weatherSuitable,
    visualDescription: typeof analysis.visualDescription === "string"
      ? analysis.visualDescription.trim().slice(0, 300)
      : ""
  };
}

export function normalizeCompleteWardrobeAnalysis(
  values: unknown[],
  candidateIds: Set<string>
) {
  const analyses: AnalyzedWardrobeItem[] = [];
  const byId = new Map<string, AnalyzedWardrobeItem>();

  for (const value of values) {
    const analysis = normalizeAnalyzedWardrobeItem(value, candidateIds);
    if (!analysis || byId.has(analysis.itemId)) return null;
    analyses.push(analysis);
    byId.set(analysis.itemId, analysis);
  }

  if (byId.size !== candidateIds.size ||
    [...candidateIds].some((id) => !byId.has(id))) {
    return null;
  }

  return { analyses, byId };
}

export function normalizeSelectedOutfitItems(values: SelectedOutfitItem[]) {
  const selections: SelectedOutfitItem[] = [];

  for (const selection of values) {
    const detectedCategory = normalizeGeminiCategory(selection?.detectedCategory);
    if (!detectedCategory || detectedCategory === "None") return null;
    selections.push({ ...selection, detectedCategory });
  }

  return selections;
}
