import { createHash } from "node:crypto";

import User from "../models/User.ts";

export const FREE_TRY_ON_LIMIT = 3;
export const TRY_ON_RESERVATION_TTL_MS = 10 * 60 * 1000;
export const TRY_ON_LIMIT_CODE = "FREE_TRY_ON_LIMIT_REACHED";
export const TRY_ON_LIMIT_MESSAGE =
  "You have used all 3 free virtual try-ons. Choose a plan to continue creating personal looks.";

export type ReservationType = "free" | "credit";

export interface QuotaStatus {
  freeTryOnsUsed: number;
  freeTryOnsRemaining: number;
  tryOnCredits: number;
  subscriptionPlan: "free" | "mini" | "style";
}

interface Reservation {
  token: string;
  type: ReservationType;
  createdAt: Date;
}

export interface TestableQuotaState {
  freeTryOnsUsed: number;
  tryOnCredits: number;
  reservations: Reservation[];
  completedRequestKeys: string[];
}

export function reserveQuotaState(
  state: TestableQuotaState,
  token: string,
  now: Date
): { state: TestableQuotaState; type: ReservationType } | null {
  const cutoff = now.getTime() - TRY_ON_RESERVATION_TTL_MS;
  const reservations = state.reservations.filter((entry) => entry.createdAt.getTime() >= cutoff);
  const freeReserved = reservations.filter((entry) => entry.type === "free").length;
  const creditReserved = reservations.filter((entry) => entry.type === "credit").length;
  const type = state.freeTryOnsUsed + freeReserved < FREE_TRY_ON_LIMIT
    ? "free"
    : state.tryOnCredits - creditReserved > 0
      ? "credit"
      : null;
  if (!type) return null;
  return {
    type,
    state: { ...state, reservations: [...reservations, { token, type, createdAt: now }] }
  };
}

export function finalizeQuotaState(
  state: TestableQuotaState,
  token: string,
  requestKey: string
): TestableQuotaState {
  if (state.completedRequestKeys.includes(requestKey)) return state;
  const reservation = state.reservations.find((entry) => entry.token === token);
  if (!reservation) return state;
  return {
    ...state,
    freeTryOnsUsed: reservation.type === "free"
      ? Math.min(FREE_TRY_ON_LIMIT, state.freeTryOnsUsed + 1)
      : state.freeTryOnsUsed,
    tryOnCredits: reservation.type === "credit"
      ? Math.max(0, state.tryOnCredits - 1)
      : state.tryOnCredits,
    reservations: state.reservations.filter((entry) => entry.token !== token),
    completedRequestKeys: [...state.completedRequestKeys, requestKey]
  };
}

export function refundQuotaState(state: TestableQuotaState, token: string): TestableQuotaState {
  return { ...state, reservations: state.reservations.filter((entry) => entry.token !== token) };
}

function statusFromUser(user: {
  freeTryOnsUsed?: number;
  tryOnCredits?: number;
  subscriptionPlan?: string;
}): QuotaStatus {
  const used = Math.min(FREE_TRY_ON_LIMIT, Math.max(0, user.freeTryOnsUsed ?? 0));
  return {
    freeTryOnsUsed: used,
    freeTryOnsRemaining: FREE_TRY_ON_LIMIT - used,
    tryOnCredits: Math.max(0, user.tryOnCredits ?? 0),
    subscriptionPlan: user.subscriptionPlan === "mini" || user.subscriptionPlan === "style"
      ? user.subscriptionPlan
      : "free"
  };
}

export function buildTryOnRequestKey(parts: {
  userId: string;
  selectionId: string;
  avatarSource: string;
  avatarIdentity: string;
}) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function reserveTryOnQuota(
  userId: string,
  token: string,
  now = new Date()
): Promise<{ type: ReservationType; status: QuotaStatus } | null> {
  const cutoff = new Date(now.getTime() - TRY_ON_RESERVATION_TTL_MS);
  const active = {
    $filter: {
      input: { $ifNull: ["$tryOnReservations", []] },
      as: "reservation",
      cond: { $gte: ["$$reservation.createdAt", cutoff] }
    }
  };
  const freeAvailable = {
    $lt: [
      {
        $add: [
          { $ifNull: ["$freeTryOnsUsed", 0] },
          {
            $size: {
              $filter: {
                input: active,
                as: "reservation",
                cond: { $eq: ["$$reservation.type", "free"] }
              }
            }
          }
        ]
      },
      FREE_TRY_ON_LIMIT
    ]
  };
  const creditAvailable = {
    $gt: [
      {
        $subtract: [
          { $ifNull: ["$tryOnCredits", 0] },
          {
            $size: {
              $filter: {
                input: active,
                as: "reservation",
                cond: { $eq: ["$$reservation.type", "credit"] }
              }
            }
          }
        ]
      },
      0
    ]
  };
  const user = await User.findOneAndUpdate(
    { _id: userId, $expr: { $or: [freeAvailable, creditAvailable] } },
    [
      {
        $set: {
          freeTryOnsUsed: { $ifNull: ["$freeTryOnsUsed", 0] },
          tryOnCredits: { $ifNull: ["$tryOnCredits", 0] },
          subscriptionPlan: { $ifNull: ["$subscriptionPlan", "free"] },
          tryOnReservations: active
        }
      },
      {
        $set: {
          tryOnReservations: {
            $concatArrays: [
              "$tryOnReservations",
              [{ token, type: { $cond: [freeAvailable, "free", "credit"] }, createdAt: now }]
            ]
          }
        }
      }
    ],
    { new: true, runValidators: false }
  ).select("freeTryOnsUsed tryOnCredits subscriptionPlan +tryOnReservations");
  if (!user) return null;
  const reservation = (user.tryOnReservations as Reservation[]).find((entry) => entry.token === token);
  if (!reservation) return null;
  return { type: reservation.type, status: statusFromUser(user) };
}

export async function finalizeTryOnQuota(
  userId: string,
  token: string,
  type: ReservationType,
  requestKey: string
): Promise<QuotaStatus> {
  const increment = type === "free"
    ? { freeTryOnsUsed: 1 }
    : { tryOnCredits: -1 };
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      completedTryOnRequestKeys: { $ne: requestKey },
      tryOnReservations: { $elemMatch: { token, type } },
      ...(type === "free"
        ? { freeTryOnsUsed: { $lt: FREE_TRY_ON_LIMIT } }
        : { tryOnCredits: { $gt: 0 } })
    },
    {
      $pull: { tryOnReservations: { token } },
      $addToSet: { completedTryOnRequestKeys: requestKey },
      $inc: increment
    },
    { new: true }
  ).select("freeTryOnsUsed tryOnCredits subscriptionPlan");
  if (user) return statusFromUser(user);

  const existing = await User.findById(userId)
    .select("freeTryOnsUsed tryOnCredits subscriptionPlan +completedTryOnRequestKeys");
  if (existing?.completedTryOnRequestKeys?.includes(requestKey)) return statusFromUser(existing);
  throw new Error("TRY_ON_QUOTA_FINALIZATION_FAILED");
}

export async function refundTryOnReservation(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $pull: { tryOnReservations: { token } } });
}

export async function releaseStaleTryOnReservations(userId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - TRY_ON_RESERVATION_TTL_MS);
  await User.updateOne(
    { _id: userId },
    { $pull: { tryOnReservations: { createdAt: { $lt: cutoff } } } }
  );
}

export async function getTryOnQuotaStatus(userId: string): Promise<QuotaStatus | null> {
  await releaseStaleTryOnReservations(userId);
  const user = await User.findById(userId).select("freeTryOnsUsed tryOnCredits subscriptionPlan");
  return user ? statusFromUser(user) : null;
}
