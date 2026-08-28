import Conversation from "../models/Conversation.ts";
import Item from "../models/Item.ts";
import MarketplaceFavorite from "../models/MarketplaceFavorite.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import PayPalPurchase from "../models/PayPalPurchase.ts";
import RestyleProject from "../models/RestyleProject.ts";
import TryOnResult from "../models/TryOnResult.ts";
import User from "../models/User.ts";

export function buildAccountDeletionFilters(userId: string, ownedItemIds: Array<string | Types.ObjectId>) {
  const ownedItems = ownedItemIds.length ? [{ item: { $in: ownedItemIds } }] : [];
  return {
    favorites: { $or: [{ user: userId }, ...ownedItems] },
    conversations: { $or: [{ participants: userId }, ...ownedItems] }
  };
}

export async function deleteUserAccountData(userId: string) {
  const ownedItemIds = await Item.find({ user: userId }).distinct("_id");
  const filters = buildAccountDeletionFilters(userId, ownedItemIds);

  await Promise.all([
    TryOnResult.deleteMany({ owner: userId }),
    RestyleProject.deleteMany({ owner: userId }),
    PayPalPurchase.deleteMany({ user: userId }),
    MarketplaceFavorite.deleteMany(filters.favorites),
    Conversation.deleteMany(filters.conversations),
    User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } })
  ]);

  await Promise.all([
    OutfitSelection.deleteMany({ user: userId }),
    Item.deleteMany({ user: userId })
  ]);

  const result = await User.deleteOne({ _id: userId });
  if (result.deletedCount !== 1) throw new Error("ACCOUNT_NOT_FOUND");
}
import type { Types } from "mongoose";
