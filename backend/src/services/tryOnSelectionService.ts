import Item from "../models/Item.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import { isDetectedCategory } from "./outfitSelectionService.ts";
import {
  resourceOwnershipError,
  validateTryOnComposition,
  type TryOnItemDescriptor
} from "./tryOnValidationService.ts";

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
  const items = await Item.find({ _id: { $in: itemIds } })
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
