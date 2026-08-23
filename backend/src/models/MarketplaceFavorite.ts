import mongoose from "mongoose";

const marketplaceFavoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    }
  },
  { timestamps: true }
);

marketplaceFavoriteSchema.index({ user: 1, item: 1 }, { unique: true });

const MarketplaceFavorite = mongoose.model(
  "MarketplaceFavorite",
  marketplaceFavoriteSchema
);

export default MarketplaceFavorite;
