import mongoose from "mongoose";

const paypalPurchaseSchema = new mongoose.Schema(
  {
    paypalOrderId: { type: String, required: true, unique: true, index: true },
    paypalCaptureId: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: String, enum: ["tryon", "restyle"], required: true, default: "tryon" },
    plan: { type: String, enum: ["mini", "style"], required: true },
    credits: { type: Number, required: true },
    amount: { type: String, required: true },
    currency: { type: String, required: true, default: "ILS" },
    status: { type: String, enum: ["CREATED", "COMPLETED", "FAILED"], default: "CREATED" },
    receiptEmailClaimedAt: { type: Date, default: null },
    receiptEmailSentAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("PayPalPurchase", paypalPurchaseSchema);
