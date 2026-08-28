import User from "../models/User.ts";

export const FREE_RESTYLE_LIMIT = 3;
export const RESTYLE_LIMIT_CODE = "RESTYLE_LIMIT_REACHED";

export async function getRestyleQuotaStatus(userId: string) {
  const user = await User.findById(userId).select("restyleFreeUses restyleCredits restyleSubscriptionPlan");
  if (!user) return null;
  const used = Math.min(FREE_RESTYLE_LIMIT, Math.max(0, user.restyleFreeUses || 0));
  return {
    restyleFreeUses: used,
    restyleFreeRemaining: FREE_RESTYLE_LIMIT - used,
    credits: Math.max(0, user.restyleCredits || 0),
    subscriptionPlan: user.restyleSubscriptionPlan
  };
}

export async function consumeRestyleQuota(userId: string): Promise<"free" | "credit" | null> {
  const free = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lt: [{ $ifNull: ["$restyleFreeUses", 0] }, FREE_RESTYLE_LIMIT] }
    },
    { $inc: { restyleFreeUses: 1 } }
  );
  if (free) return "free";
  const credit = await User.findOneAndUpdate(
    { _id: userId, restyleCredits: { $gt: 0 } },
    { $inc: { restyleCredits: -1 } }
  );
  return credit ? "credit" : null;
}

export async function refundRestyleQuota(userId: string, type: "free" | "credit") {
  await User.updateOne(
    { _id: userId },
    { $inc: type === "free" ? { restyleFreeUses: -1 } : { restyleCredits: 1 } }
  );
}
