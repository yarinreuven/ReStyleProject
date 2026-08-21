import mongoose from "mongoose";

const marketplaceImageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true }
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Tops",
        "Bottoms",
        "Dresses",
        "Jackets",
        "Shoes",
        "Bags",
        "Accessories"
      ]
    },

    color: {
      type: String,
      required: true,
      trim: true
    },

    season: {
      type: String,
      required: true,
      enum: [
        "All Season",
        "Summer",
        "Winter",
        "Spring",
        "Fall"
      ]
    },

    style: {
      type: String,
      required: true,
      enum: [
        "Casual",
        "Classic",
        "Elegant",
        "Sporty",
        "Streetwear"
      ]
    },

    image: {
      data: Buffer,
      contentType: String
    },

    listingType: {
      type: String,
      enum: ["sale", "rent", null],
      default: null
    },

    price: {
      type: Number,
      min: 0,
      default: null
    },

    rentalPricePerDay: {
      type: Number,
      min: 0,
      default: null
    },

    size: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null
    },

    condition: {
      type: String,
      enum: ["New", "Like New", "Excellent", "Good", "Fair", null],
      default: null
    },

    brand: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null
    },

    marketplaceImages: {
      type: [marketplaceImageSchema],
      default: []
    },

    availabilityStatus: {
      type: String,
      enum: ["active", "reserved", "sold", "rented", "hidden"],
      default: "hidden",
      index: true
    },

    favorite: {
      type: Boolean,
      default: false
    },

    wearCount: {
      type: Number,
      default: 0,
      min: 0
    },

    lastWornAt: {
      type: Date,
      default: null
    },

    wornDates: [{
      type: Date
    }]
  },
  {
    timestamps: true
  }
);

itemSchema.index({ availabilityStatus: 1, listingType: 1, createdAt: -1 });

const Item = mongoose.model("Item", itemSchema);

export default Item;
