import Item from "../models/Item.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import sharp from "sharp";
import { inferRequiredGarmentType } from "./geminiTryOnService.ts";
import { isDetectedCategory } from "./outfitSelectionService.ts";
import {
  orderTryOnItems,
  resourceOwnershipError,
  validateTryOnComposition,
  type TryOnItemDescriptor
} from "./tryOnValidationService.ts";

export async function prepareTryOnGarmentInputs(
  selectionItems: TryOnItemDescriptor[],
  items: Array<{
    _id: { toString(): string };
    name: string;
    image?: { data?: Buffer; contentType?: string };
  }>
) {
  const itemsById = new Map(items.map((item) => [item._id.toString(), item]));
  const orderedSelectionItems = orderTryOnItems(selectionItems);
  const tryOnInputs = [];

  for (const entry of orderedSelectionItems) {
    const item = itemsById.get(entry.itemId)!;
    if (!item.image?.data || !item.image.contentType ||
      !["image/jpeg", "image/png", "image/webp"].includes(item.image.contentType)) {
      return {
        success: false as const,
        status: 404,
        message: `The selected item "${item.name}" no longer has a valid image`
      };
    }

    let metadata;
    try {
      metadata = await sharp(item.image.data).metadata();
    } catch {
      return {
        success: false as const,
        status: 404,
        message: `The selected item "${item.name}" has a damaged image`
      };
    }
    const expectedFormat = item.image.contentType === "image/jpeg"
      ? "jpeg"
      : item.image.contentType.replace("image/", "");
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
      return {
        success: false as const,
        status: 404,
        message: `The selected item "${item.name}" has an invalid image format`
      };
    }

    tryOnInputs.push({
      itemId: entry.itemId,
      name: item.name,
      detectedCategory: entry.detectedCategory,
      visualDescription: entry.visualDescription,
      requiredGarmentType: inferRequiredGarmentType(
        item.name,
        entry.detectedCategory,
        entry.visualDescription
      ),
      data: item.image.data,
      contentType: item.image.contentType
    });
  }

  return {
    success: true as const,
    orderedSelectionItems,
    tryOnInputs,
    responseItems: orderedSelectionItems.map((entry) => ({
      itemId: entry.itemId,
      detectedCategory: entry.detectedCategory,
      name: itemsById.get(entry.itemId)!.name
    }))
  };
}

export async function resolveTryOnSelection(userId: string, selectionId: string) {
  const selection = await OutfitSelection.findById(selectionId);
  if (!selection || selection.expiresAt <= new Date()) {
    return {
      success: false as const,
      status: 404,
      message: "The saved outfit was not found or has expired"
    };
  }
  if (selection.user.toString() !== userId) {
    return {
      success: false as const,
      status: 403,
      message: "You cannot use this saved outfit"
    };
  }

  const selectionItems: TryOnItemDescriptor[] = [];
  for (const entry of selection.items) {
    if (!isDetectedCategory(entry.detectedCategory)) {
      return {
        success: false as const,
        status: 400,
        message: "The saved outfit contains an invalid category"
      };
    }
    selectionItems.push({
      itemId: entry.item.toString(),
      detectedCategory: entry.detectedCategory,
      visualDescription: entry.visualDescription
    });
  }

  const compositionError = validateTryOnComposition(selectionItems);
  if (compositionError) {
    return { success: false as const, status: 400, message: compositionError };
  }

  const itemIds = selectionItems.map((entry) => entry.itemId);
  const items = await Item.find({
    _id: { $in: itemIds },
    listingType: null
  })
    .select("name category image user");
  const ownershipError = resourceOwnershipError({
    userId,
    selectionOwnerId: selection.user.toString(),
    selectedItemIds: itemIds,
    items: items.map((item) => ({
      itemId: item._id.toString(),
      ownerId: item.user.toString()
    }))
  });
  if (ownershipError) {
    return { success: false as const, ...ownershipError };
  }

  return {
    success: true as const,
    selection,
    selectionItems,
    items
  };
}
