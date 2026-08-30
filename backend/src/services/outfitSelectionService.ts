export const DETECTED_CATEGORIES = [
  "Dress",
  "Top",
  "Bottom",
  "Jacket",
  "Shoes",
  "Bag",
  "Accessory"
] as const;

export type DetectedCategory = typeof DETECTED_CATEGORIES[number];

export interface ShortlistCandidate {
  id: string;
  category: string;
  favorite: boolean;
  wearCount: number;
  lastWornAt?: Date | null;
}

export interface SelectedOutfitItem {
  itemId: string;
  detectedCategory: DetectedCategory;
  reason: string;
}

export interface VerifiedCandidate {
  ownerVerified: boolean;
  hasValidImage: boolean;
  detectedCategory: DetectedCategory;
  eventSuitable: boolean;
  styleSuitable: boolean;
  weatherSuitable: boolean;
}

export interface OutfitCohesion {
  colorsCoordinate: boolean;
  formalityCoordinates: boolean;
  silhouettesCoordinate: boolean;
  occasionCoordinates: boolean;
}

export function outfitCohesionValidationError(cohesion: OutfitCohesion) {
  return cohesion.colorsCoordinate && cohesion.formalityCoordinates &&
    cohesion.silhouettesCoordinate && cohesion.occasionCoordinates
    ? ""
    : "Your wardrobe does not contain a cohesive look for this request. Try different preferences or add more suitable items.";
}

const PROJECT_TO_DETECTED_CATEGORY: Record<string, DetectedCategory> = {
  Dresses: "Dress",
  Tops: "Top",
  Bottoms: "Bottom",
  Jackets: "Jacket",
  Shoes: "Shoes",
  Bags: "Bag",
  Accessories: "Accessory"
};

export function normalizeProjectCategory(category: string) {
  return PROJECT_TO_DETECTED_CATEGORY[category] || null;
}

export function isDetectedCategory(value: unknown): value is DetectedCategory {
  return typeof value === "string" &&
    (DETECTED_CATEGORIES as readonly string[]).includes(value);
}

export function selectNoCostOutfitItems<T extends { category: string }>(items: T[]) {
  const byCategory = new Map<DetectedCategory, T>();

  for (const item of items) {
    const detectedCategory = normalizeProjectCategory(item.category);
    if (detectedCategory && !byCategory.has(detectedCategory)) {
      byCategory.set(detectedCategory, item);
    }
  }

  const baseCategories: DetectedCategory[] = byCategory.has("Dress")
    ? ["Dress"]
    : byCategory.has("Top") && byCategory.has("Bottom")
      ? ["Top", "Bottom"]
      : [];
  if (baseCategories.length === 0) return [];

  const optionalCategories: DetectedCategory[] = [
    "Jacket",
    "Shoes",
    "Bag",
    "Accessory"
  ];

  return [...baseCategories, ...optionalCategories.filter((category) => byCategory.has(category))]
    .map((detectedCategory) => ({
      item: byCategory.get(detectedCategory)!,
      detectedCategory
    }));
}

function shortlistPriority(left: ShortlistCandidate, right: ShortlistCandidate) {
  if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
  if (left.wearCount !== right.wearCount) return left.wearCount - right.wearCount;

  const leftWornAt = left.lastWornAt ? new Date(left.lastWornAt).getTime() : 0;
  const rightWornAt = right.lastWornAt ? new Date(right.lastWornAt).getTime() : 0;
  if (leftWornAt !== rightWornAt) return leftWornAt - rightWornAt;
  return left.id.localeCompare(right.id);
}

export function createBalancedWardrobeShortlist<T extends ShortlistCandidate>(
  candidates: T[],
  limit = 30
) {
  if (candidates.length <= limit) return [...candidates].sort(shortlistPriority);

  const selected: T[] = [];
  const selectedIds = new Set<string>();

  for (const projectCategory of Object.keys(PROJECT_TO_DETECTED_CATEGORY)) {
    const representative = candidates
      .filter((candidate) => candidate.category === projectCategory)
      .sort(shortlistPriority)[0];

    if (representative && selected.length < limit) {
      selected.push(representative);
      selectedIds.add(representative.id);
    }
  }

  const remaining = candidates
    .filter((candidate) => !selectedIds.has(candidate.id))
    .sort(shortlistPriority);

  selected.push(...remaining.slice(0, Math.max(0, limit - selected.length)));
  return selected;
}

export function selectedOutfitValidationError(
  selections: SelectedOutfitItem[],
  candidates: Map<string, VerifiedCandidate>
) {
  if (!Array.isArray(selections) || selections.length === 0) {
    return "The selected outfit does not contain a complete outfit base";
  }

  const ids = selections.map((selection) => selection.itemId);
  if (new Set(ids).size !== ids.length) {
    return "The selected outfit contains duplicate item IDs";
  }

  for (const selection of selections) {
    if (!selection || typeof selection.itemId !== "string") {
      return "The selected outfit contains an invalid item ID";
    }
    if (!isDetectedCategory(selection.detectedCategory)) {
      return "The selected outfit contains an invalid detected category";
    }

    const candidate = candidates.get(selection.itemId);
    if (!candidate) return "The selected outfit contains an item that was not sent to Gemini";
    if (!candidate.ownerVerified) return "The selected outfit contains an item owned by another user";
    if (!candidate.hasValidImage) return "The selected outfit contains an item without a valid image";
    if (candidate.detectedCategory !== selection.detectedCategory) {
      return "The selected outfit contains a category that does not match the verified visual analysis";
    }
    if (!candidate.eventSuitable || !candidate.styleSuitable || !candidate.weatherSuitable) {
      return "The selected outfit contains an item that does not match the request";
    }
  }

  const count = (category: DetectedCategory) =>
    selections.filter((selection) => selection.detectedCategory === category).length;
  const hasDressBase = count("Dress") === 1 && count("Top") === 0 && count("Bottom") === 0;
  const hasSeparatesBase = count("Dress") === 0 && count("Top") === 1 && count("Bottom") === 1;

  if (!hasDressBase && !hasSeparatesBase) {
    return "A complete outfit needs exactly one dress, or exactly one top and one bottom";
  }

  for (const category of DETECTED_CATEGORIES) {
    if (count(category) > 1) {
      return `The outfit may include at most one ${category.toLowerCase()} item`;
    }
  }

  for (const category of ["Shoes", "Bag", "Accessory"] as DetectedCategory[]) {
    const hasSuitableCandidate = [...candidates.values()].some((candidate) =>
      candidate.ownerVerified && candidate.hasValidImage &&
      candidate.detectedCategory === category && candidate.eventSuitable &&
      candidate.styleSuitable && candidate.weatherSuitable
    );
    if (hasSuitableCandidate && count(category) !== 1) {
      return `The outfit must include one suitable ${category.toLowerCase()} item from the wardrobe`;
    }
  }

  return "";
}
