import mongoose from "mongoose";

const tryOnResultSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    selection: { type: mongoose.Schema.Types.ObjectId, ref: "OutfitSelection", required: true },
    requestKey: { type: String, required: true, unique: true },
    attemptId: { type: String, required: true },
    status: { type: String, enum: ["pending", "succeeded", "failed"], required: true },
    reservationToken: { type: String, default: null },
    reservationType: { type: String, enum: ["free", "credit", null], default: null },
    quotaCommitted: { type: Boolean, default: false },
    avatarSource: { type: String, enum: ["preset", "personal", "upload"], required: true },
    avatarIdentity: { type: String, required: true },
    image: {
      data: Buffer,
      contentType: String
    },
    items: [{
      item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
      name: { type: String, required: true },
      detectedCategory: {
        type: String,
        enum: ["Dress", "Top", "Bottom", "Jacket", "Shoes", "Bag", "Accessory"],
        required: true
      },
      _id: false
    }],
    validation: {
      valid: Boolean,
      fullBodyVisible: Boolean,
      facePreserved: Boolean,
      baseOutfitPresent: Boolean,
      exactGarmentsMatchReferences: Boolean,
      jacketPresent: Boolean,
      shoesPresent: Boolean,
      bagPresent: Boolean,
      accessoryPresent: Boolean,
      unexpectedItemsDetected: Boolean,
      failureReasons: [String]
    },
    failureCode: { type: String, default: null },
    savedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

const TryOnResult = mongoose.model("TryOnResult", tryOnResultSchema);
export default TryOnResult;
