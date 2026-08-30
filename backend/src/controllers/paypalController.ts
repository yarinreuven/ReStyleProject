import type { NextFunction, Request, Response } from "express";

import type { AuthRequest } from "../middleware/auth.ts";
import PayPalPurchase from "../models/PayPalPurchase.ts";
import User from "../models/User.ts";
import logger from "../services/logger.ts";
import { sendPaymentReceiptEmail } from "../services/emailService.ts";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalClientConfiguration,
  getPayPalPlan,
  verifyPayPalWebhook,
  type PayPalPlan,
  type PayPalProduct
} from "../services/paypalService.ts";

async function sendReceiptOnce(orderId: string) {
  const purchase = await PayPalPurchase.findOneAndUpdate(
    {
      paypalOrderId: orderId,
      receiptEmailSentAt: null,
      $or: [
        { receiptEmailClaimedAt: null },
        { receiptEmailClaimedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }
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
        planName: `${purchase.product === "restyle" ? "ReStyle Studio" : "Virtual Try-on"} · ${purchase.plan === "mini" ? "Mini" : "Style"}`,
        creditLabel: purchase.product === "restyle"
          ? "ReStyle Studio credits"
          : "Virtual try-on credits",
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
    logger.error({ err: error }, "Could not send PayPal receipt email");
  }
}

async function grantCredits(orderId: string, captureId?: string) {
  const purchase = await PayPalPurchase.findOne({ paypalOrderId: orderId });
  if (!purchase) throw new Error("Purchase record not found");

  const isRestyle = purchase.product === "restyle";
  await User.findOneAndUpdate(
    { _id: purchase.user, completedPayPalOrderIds: { $ne: orderId } },
    {
      $inc: isRestyle
        ? { restyleCredits: purchase.credits }
        : { tryOnCredits: purchase.credits },
      $set: isRestyle
        ? { restyleSubscriptionPlan: purchase.plan }
        : { subscriptionPlan: purchase.plan },
      $push: { completedPayPalOrderIds: orderId }
    }
  );
  purchase.status = "COMPLETED";
  if (captureId) purchase.paypalCaptureId = captureId;
  await purchase.save();
  await sendReceiptOnce(orderId);
  return purchase;
}

export async function handlePayPalWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
}

export function getPayPalConfig(_req: AuthRequest, res: Response) {
  try {
    res.json(getPayPalClientConfiguration());
  } catch (error) {
    res.status(503).json({ success: false, message: (error as Error).message });
  }
}

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const plan = req.body.plan as PayPalPlan;
    const product = req.body.product as PayPalProduct;
    const order = await createPayPalOrder(plan, product, String(req.userId));
    const selected = getPayPalPlan(product, plan);
    await PayPalPurchase.create({
      paypalOrderId: order.id,
      user: req.userId,
      product,
      plan,
      credits: selected.credits,
      amount: selected.amount,
      currency: "ILS"
    });
    res.status(201).json({ id: order.id });
  } catch (error) {
    next(error);
  }
}

export async function captureOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const orderId = String(req.params.orderId);
    const purchase = await PayPalPurchase.findOne({ paypalOrderId: orderId, user: req.userId });
    if (!purchase) {
      res.status(404).json({ success: false, message: "PayPal order not found" });
      return;
    }
    const order = await capturePayPalOrder(orderId);
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const paid = capture?.amount || unit?.amount;
    if (order.status !== "COMPLETED" ||
      paid?.currency_code !== purchase.currency ||
      paid?.value !== purchase.amount) {
      res.status(409).json({
        success: false,
        message: "PayPal did not confirm the expected payment"
      });
      return;
    }

    await grantCredits(orderId, capture?.id);
    const user = await User.findById(req.userId)
      .select("tryOnCredits subscriptionPlan restyleCredits restyleSubscriptionPlan");
    const isRestyle = purchase.product === "restyle";
    res.json({
      success: true,
      product: purchase.product,
      creditsAdded: purchase.credits,
      tryOnCredits: user?.tryOnCredits,
      restyleCredits: user?.restyleCredits,
      subscriptionPlan: isRestyle ? user?.restyleSubscriptionPlan : user?.subscriptionPlan
    });
  } catch (error) {
    next(error);
  }
}
