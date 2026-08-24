import mongoose from "mongoose";

const detectedCategories = [
  "Dress", "Top", "Bottom", "Jacket", "Shoes", "Bag", "Accessory"
];

const selectedItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    detectedCategory: {
      type: String,
      enum: detectedCategories,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
      required: true
    }
  },
  { _id: false }
);

const outfitSelectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: { type: String, trim: true, maxlength: 200, required: true },
    explanation: { type: String, trim: true, maxlength: 1000, required: true },
    stylingTips: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: []
    },
    items: {
      type: [selectedItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length >= 1 && items.length <= 7,
        message: "An outfit selection must contain between 1 and 7 items"
      }
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 }
    }
  },
  { timestamps: true }
);

const OutfitSelection = mongoose.model("OutfitSelection", outfitSelectionSchema);

export default OutfitSelection;
