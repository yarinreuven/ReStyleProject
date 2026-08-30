import TryOnResult from "../models/TryOnResult.ts";
import {
  finalizeTryOnQuota,
  getTryOnQuotaStatus,
  isLocalTryOnQuotaBypass,
  type QuotaStatus,
  type ReservationType
} from "./tryOnQuotaService.ts";

interface SuccessfulTryOnResult {
  _id: unknown;
  quotaCommitted?: boolean;
  reservationToken?: string | null;
  reservationType?: string | null;
}

export function needsTryOnQuotaCommit(
  result: SuccessfulTryOnResult,
  quotaBypass: boolean
) {
  return !quotaBypass && !result.quotaCommitted &&
    Boolean(result.reservationToken && result.reservationType);
}

export async function resolveSuccessfulTryOnQuota(
  userId: string,
  result: SuccessfulTryOnResult,
  requestKey: string
): Promise<QuotaStatus> {
  let quota = await getTryOnQuotaStatus(userId);
  const quotaBypass = isLocalTryOnQuotaBypass();

  if (needsTryOnQuotaCommit(result, quotaBypass)) {
    quota = await finalizeTryOnQuota(
      userId,
      result.reservationToken!,
      result.reservationType as ReservationType,
      requestKey
    );
    await TryOnResult.updateOne(
      { _id: result._id, quotaCommitted: false },
      { $set: { quotaCommitted: true } }
    );
  }

  if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
  return quota;
}
