import type { Types } from "mongoose";

import type { DetectedCategory } from "./outfitSelectionService.ts";
import type { QuotaStatus } from "./tryOnQuotaService.ts";

export function buildTryOnSuccessResponse(input: {
  selectionId: Types.ObjectId;
  imageData: Buffer;
  contentType: string;
  items: Array<{
    itemId: string;
    detectedCategory: DetectedCategory;
    name: string;
  }>;
  quota: QuotaStatus;
  cached: boolean;
}) {
  return {
    success: true,
    renderer: "gemini",
    selectionId: input.selectionId,
    tryOnImage: `data:${input.contentType};base64,${input.imageData.toString("base64")}`,
    items: input.items,
    validation: { valid: true },
    ...input.quota,
    cached: input.cached
  };
}
