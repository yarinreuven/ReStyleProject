import mongoose from "mongoose";

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

const Item = mongoose.model("Item", itemSchema);

export default Item;
