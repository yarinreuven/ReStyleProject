import type { DetectedCategory } from "./outfitSelectionService.ts";
import mongoose from "mongoose";

export const APPROVED_AVATAR_IDS = [
  "female-illustrated",
  "male-illustrated"
] as const;

export type ApprovedAvatarId = typeof APPROVED_AVATAR_IDS[number];
export type AvatarSource = "preset" | "personal" | "upload";

export interface TryOnItemDescriptor {
  itemId: string;
  detectedCategory: DetectedCategory;
  visualDescription?: string;
}

export interface TryOnQualityResult {
  valid: boolean;
  fullBodyVisible: boolean;
  facePreserved: boolean;
  baseOutfitPresent: boolean;
  exactGarmentsMatchReferences: boolean;
  jacketPresent: boolean;
  shoesPresent: boolean;
  bagPresent: boolean;
  accessoryPresent: boolean;
  unexpectedItemsDetected: boolean;
  failureReasons: string[];
}

export function generatedImageAcceptedForUserReview(
  items: TryOnItemDescriptor[]
): TryOnQualityResult {
  const has = (category: DetectedCategory) =>
    items.some((item) => item.detectedCategory === category);
  return {
    valid: true,
    fullBodyVisible: true,
    facePreserved: true,
    baseOutfitPresent: true,
    exactGarmentsMatchReferences: true,
    jacketPresent: has("Jacket"),
    shoesPresent: has("Shoes"),
    bagPresent: has("Bag"),
    accessoryPresent: has("Accessory"),
    unexpectedItemsDetected: false,
    failureReasons: []
  };
}

export function existingTryOnAction(
  status: "pending" | "succeeded" | "failed",
  updatedAt: Date,
  now: Date,
  pendingTtlMs: number
): "cache" | "in-progress" | "retry" {
  if (status === "succeeded") return "cache";
  if (status === "pending" && updatedAt.getTime() >= now.getTime() - pendingTtlMs) {
    return "in-progress";
  }
  return "retry";
}

export function hasForbiddenTryOnOverrides(body: Record<string, unknown>) {
  return [
    "itemIds", "detectedCategory", "detectedCategories", "userId", "owner",
    "freeTryOnsUsed", "freeTryOnsRemaining", "tryOnCredits", "subscriptionPlan",
    "tryOnReservations", "reservationToken", "quotaCommitted"
  ]
    .some((field) => body[field] !== undefined);
}

export function tryOnRequestValidationError(body: Record<string, unknown>) {
  if (hasForbiddenTryOnOverrides(body)) {
    return "The try-on must use the saved verified outfit selection";
  }
  if (!mongoose.isValidObjectId(body.selectionId)) {
    return "Choose a valid saved outfit";
  }
  return "";
}

export function resourceOwnershipError(input: {
  userId: string;
  selectionOwnerId: string;
  selectedItemIds: string[];
  items: Array<{ itemId: string; ownerId: string }>;
}): { status: number; message: string } | null {
  if (input.selectionOwnerId !== input.userId) {
    return { status: 403, message: "You cannot use this saved outfit" };
  }
  const itemsById = new Map(input.items.map((item) => [item.itemId, item]));
  if (input.selectedItemIds.some((itemId) => !itemsById.has(itemId))) {
    return { status: 404, message: "One or more selected items no longer exist" };
  }
  if (input.selectedItemIds.some((itemId) =>
    itemsById.get(itemId)?.ownerId !== input.userId
  )) {
    return { status: 403, message: "You cannot use this saved outfit" };
  }
  return null;
}

const CATEGORY_ORDER: Record<DetectedCategory, number> = {
  Dress: 0,
  Top: 0,
  Bottom: 1,
  Jacket: 2,
  Shoes: 3,
  Bag: 4,
  Accessory: 5
};

export function isApprovedAvatarId(value: unknown): value is ApprovedAvatarId {
  return typeof value === "string" &&
    (APPROVED_AVATAR_IDS as readonly string[]).includes(value);
}

export function validateTryOnComposition(items: TryOnItemDescriptor[]) {
  const count = (category: DetectedCategory) =>
    items.filter((item) => item.detectedCategory === category).length;
  const hasDress = count("Dress") === 1 && count("Top") === 0 && count("Bottom") === 0;
  const hasSeparates = count("Dress") === 0 && count("Top") === 1 && count("Bottom") === 1;

  if (!hasDress && !hasSeparates) {
    return "A try-on requires exactly one dress, or exactly one top and one bottom";
  }
  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    return "The saved outfit contains duplicate items";
  }
  for (const category of Object.keys(CATEGORY_ORDER) as DetectedCategory[]) {
    if (count(category) > 1) return `The saved outfit contains too many ${category} items`;
  }
  return "";
}

export function orderTryOnItems<T extends TryOnItemDescriptor>(items: T[]) {
  return [...items].sort((left, right) =>
    CATEGORY_ORDER[left.detectedCategory] - CATEGORY_ORDER[right.detectedCategory] ||
    left.itemId.localeCompare(right.itemId)
  );
}

export function uploadedAvatarValidationError(input: {
  declaredMimeType: string;
  detectedFormat?: string;
  size: number;
  width?: number;
  height?: number;
}) {
  const formats: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  if (input.size <= 0 || input.size > 5 * 1024 * 1024) {
    return "The full-body image must be smaller than 5MB";
  }
  const detectedMimeType = input.detectedFormat
    ? formats[input.detectedFormat.toLowerCase()]
    : undefined;
  if (!detectedMimeType || detectedMimeType !== input.declaredMimeType) {
    return "The full-body image must be a genuine JPG, PNG or WEBP image";
  }
  if (!input.width || !input.height || input.width < 300 || input.height < 600 ||
    input.height / input.width < 1.15) {
    return "Choose a clear vertical full-body image with the person visible from head to feet";
  }
  return "";
}

export function qualityValidationError(
  quality: TryOnQualityResult,
  items: TryOnItemDescriptor[]
) {
  const booleanFields: Array<keyof TryOnQualityResult> = [
    "valid", "fullBodyVisible", "facePreserved", "baseOutfitPresent", "exactGarmentsMatchReferences",
    "jacketPresent", "shoesPresent", "bagPresent", "accessoryPresent",
    "unexpectedItemsDetected"
  ];
  if (!quality || booleanFields.some((field) => typeof quality[field] !== "boolean") ||
    !Array.isArray(quality.failureReasons) ||
    quality.failureReasons.some((reason) => typeof reason !== "string")) {
    return "The try-on validation result is incomplete";
  }
  if (!quality || !quality.valid || !quality.fullBodyVisible ||
    !quality.facePreserved || !quality.baseOutfitPresent) {
    return "The generated image did not preserve a complete, clear try-on";
  }
  if (!quality.exactGarmentsMatchReferences) {
    return "The generated image changed the type, silhouette or length of a selected garment";
  }
  const categories = new Set(items.map((item) => item.detectedCategory));
  if (categories.has("Jacket") && !quality.jacketPresent) return "The selected jacket is missing";
  if (categories.has("Shoes") && !quality.shoesPresent) return "The selected shoes are missing";
  if (categories.has("Bag") && !quality.bagPresent) return "The selected bag is missing";
  if (categories.has("Accessory") && !quality.accessoryPresent) return "The selected accessory is missing";
  if (quality.unexpectedItemsDetected) return "The generated image contains unselected fashion items";
  return "";
}
