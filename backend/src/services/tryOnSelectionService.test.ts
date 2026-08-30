import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { prepareTryOnGarmentInputs } from "./tryOnSelectionService.ts";

test("prepares ordered and verified garment inputs for virtual try-on", async () => {
  const image = await sharp({
    create: {
      width: 20,
      height: 30,
      channels: 3,
      background: "white"
    }
  }).png().toBuffer();
  const itemId = "507f1f77bcf86cd799439011";
  const result = await prepareTryOnGarmentInputs(
    [{ itemId, detectedCategory: "Top", visualDescription: "Cotton shirt" }],
    [{
      _id: { toString: () => itemId },
      name: "White shirt",
      image: { data: image, contentType: "image/png" }
    }]
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.tryOnInputs[0].name, "White shirt");
  assert.equal(result.tryOnInputs[0].contentType, "image/png");
  assert.equal(result.responseItems[0].detectedCategory, "Top");
});

test("rejects missing and mismatched garment images", async () => {
  const itemId = "507f1f77bcf86cd799439011";
  const selection = [{ itemId, detectedCategory: "Top" as const }];
  const missing = await prepareTryOnGarmentInputs(selection, [{
    _id: { toString: () => itemId },
    name: "White shirt"
  }]);
  assert.equal(missing.success, false);
  if (!missing.success) assert.match(missing.message, /no longer has a valid image/);

  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" }
  }).png().toBuffer();
  const mismatched = await prepareTryOnGarmentInputs(selection, [{
    _id: { toString: () => itemId },
    name: "White shirt",
    image: { data: png, contentType: "image/jpeg" }
  }]);
  assert.equal(mismatched.success, false);
  if (!mismatched.success) assert.match(mismatched.message, /invalid image format/);
});
