import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { buildTryOnSuccessResponse } from "./tryOnResponseService.ts";

test("builds the stable virtual try-on response consumed by the frontend", () => {
  const selectionId = new mongoose.Types.ObjectId();
  const result = buildTryOnSuccessResponse({
    selectionId,
    imageData: Buffer.from("generated-image"),
    contentType: "image/png",
    items: [{ itemId: "item-1", detectedCategory: "Top", name: "White shirt" }],
    quota: {
      freeTryOnsUsed: 1,
      freeTryOnsRemaining: 2,
      tryOnCredits: 0,
      subscriptionPlan: "free"
    },
    cached: false
  });

  assert.equal(result.success, true);
  assert.equal(result.renderer, "gemini");
  assert.equal(result.selectionId, selectionId);
  assert.equal(
    result.tryOnImage,
    `data:image/png;base64,${Buffer.from("generated-image").toString("base64")}`
  );
  assert.deepEqual(result.validation, { valid: true });
  assert.equal(result.freeTryOnsRemaining, 2);
  assert.equal(result.cached, false);
});
