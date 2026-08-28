import express from "express";
import Joi from "joi";
import mongoose from "mongoose";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import PayPalPurchase from "../models/PayPalPurchase.ts";
import User from "../models/User.ts";
import { sendPaymentReceiptEmail } from "../services/emailService.ts";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalClientConfiguration,
  PAYPAL_PLANS,
  verifyPayPalWebhook,
  type PayPalPlan
} from "../services/paypalService.ts";

const router = express.Router();
const planSchema = Joi.object({ plan: Joi.string().valid("mini", "style").required() });
const orderIdSchema = Joi.string().pattern(/^[A-Z0-9]+$/).max(30).required();

async function sendReceiptOnce(orderId: string) {
  const staleClaim = new Date(Date.now() - 10 * 60 * 1000);
  const purchase = await PayPalPurchase.findOneAndUpdate(
    {
      paypalOrderId: orderId,
      receiptEmailSentAt: null,
      $or: [
        { receiptEmailClaimedAt: null },
        { receiptEmailClaimedAt: { $lt: staleClaim } }
      ]
    },
    { $set: { receiptEmailClaimedAt: new Date() } },
    { new: true }
  );
  if (!purchase) return;

  try {
    const user = await User.findById(purchase.user).select("firstName lastName email");
    if (!user) throw new Error("Receipt recipient not found");
    await sendPaymentReceiptEmail(
      user.email,
      `${user.firstName} ${user.lastName}`.trim(),
      {
        orderId,
        planName: purchase.plan === "mini" ? "Mini · 10 try-ons" : "Style · 30 try-ons",
        credits: purchase.credits,
        amount: purchase.amount,
        currency: purchase.currency,
        paidAt: new Date()
      }
    );
    await PayPalPurchase.updateOne(
      { _id: purchase._id },
      { $set: { receiptEmailSentAt: new Date() }, $unset: { receiptEmailClaimedAt: 1 } }
    );
  } catch (error) {
    await PayPalPurchase.updateOne(
      { _id: purchase._id },
      { $unset: { receiptEmailClaimedAt: 1 } }
    );
    console.error("Could not send PayPal receipt email:", (error as Error).message);
  }
}

async function grantCredits(orderId: string, captureId?: string) {
  const purchase = await PayPalPurchase.findOne({ paypalOrderId: orderId });
  if (!purchase) throw new Error("Purchase record not found");

  await User.findOneAndUpdate(
    { _id: purchase.user, completedPayPalOrderIds: { $ne: orderId } },
    {
      $inc: { tryOnCredits: purchase.credits },
      $set: { subscriptionPlan: purchase.plan },
      $push: { completedPayPalOrderIds: orderId }
    }
  );
  purchase.status = "COMPLETED";
  if (captureId) purchase.paypalCaptureId = captureId;
  await purchase.save();
  await sendReceiptOnce(orderId);
  return purchase;
}

router.post("/webhook", async (req, res, next) => {
  try {
    if (!await verifyPayPalWebhook(req.headers, req.body)) {
      res.status(400).json({ success: false, message: "Invalid PayPal webhook signature" });
      return;
    }
    if (req.body?.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = req.body?.resource?.supplementary_data?.related_ids?.order_id;
      const captureId = req.body?.resource?.id;
      if (orderId && await PayPalPurchase.exists({ paypalOrderId: orderId })) {
        await grantCredits(orderId, captureId);
      }
    }
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

router.use(authenticateToken);

router.get("/config", (_req, res) => {
  try {
    res.json(getPayPalClientConfiguration());
  } catch (error) {
    res.status(503).json({ success: false, message: (error as Error).message });
  }
});

router.post("/orders", async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = planSchema.validate(req.body);
    if (error || !req.userId || !mongoose.isValidObjectId(req.userId)) {
      res.status(error ? 400 : 401).json({ success: false, message: error?.message || "Authentication is required" });
      return;
    }
    const plan = value.plan as PayPalPlan;
    const order = await createPayPalOrder(plan, req.userId);
    const selected = PAYPAL_PLANS[plan];
    await PayPalPurchase.create({
      paypalOrderId: order.id,
      user: req.userId,
      plan,
      credits: selected.credits,
      amount: selected.amount,
      currency: "ILS"
    });
    res.status(201).json({ id: order.id });
  } catch (error) {
    next(error);
  }
});

router.post("/orders/:orderId/capture", async (req: AuthRequest, res, next) => {
  try {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const { error } = orderIdSchema.validate(orderId);
    if (error || !req.userId) {
      res.status(error ? 400 : 401).json({ success: false, message: error?.message || "Authentication is required" });
      return;
    }
    const purchase = await PayPalPurchase.findOne({ paypalOrderId: orderId, user: req.userId });
    if (!purchase) {
      res.status(404).json({ success: false, message: "PayPal order not found" });
      return;
    }
    const order = await capturePayPalOrder(orderId);
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const paid = capture?.amount || unit?.amount;
    if (order.status !== "COMPLETED" || paid?.currency_code !== purchase.currency || paid?.value !== purchase.amount) {
      res.status(409).json({ success: false, message: "PayPal did not confirm the expected payment" });
      return;
    }
    await grantCredits(orderId, capture?.id);
    const user = await User.findById(req.userId).select("freeTryOnsUsed tryOnCredits subscriptionPlan");
    res.json({ success: true, creditsAdded: purchase.credits, tryOnCredits: user?.tryOnCredits, subscriptionPlan: user?.subscriptionPlan });
  } catch (error) {
    next(error);
  }
});

export default router;
