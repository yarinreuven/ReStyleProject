import mongoose from "mongoose";

const marketplaceImageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true }
  },
  { _id: false }
);

const marketplaceListingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
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
    size: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    condition: {
      type: String,
      required: true,
      enum: ["New", "Like New", "Good", "Fair"]
    },
    listingType: {
      type: String,
      required: true,
      enum: ["Sale", "Rent", "Sale or Rent"]
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null
    },
    rentalPricePerDay: {
      type: Number,
      min: 0,
      default: null
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    contactMethod: {
      type: String,
      required: true,
      enum: ["Email", "Phone", "WhatsApp"]
    },
    contactValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    images: {
      type: [marketplaceImageSchema],
      required: true,
      validate: {
        validator: (images: unknown[]) => images.length >= 1 && images.length <= 4,
        message: "A listing needs between one and four images"
      }
    },
    status: {
      type: String,
      enum: ["Active", "Reserved", "Sold", "Rented", "Hidden"],
      default: "Active",
      index: true
    }
  },
  { timestamps: true }
);

const MarketplaceListing = mongoose.model(
  "MarketplaceListing",
  marketplaceListingSchema
);

export default MarketplaceListing;
