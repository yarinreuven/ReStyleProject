import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  preparePersonalModelValidationParts,
  resolveTryOnAvatar,
  validateAvatarImage
} from "./tryOnAvatarService.ts";

test("prepares a personal model photo as JPEG for Gemini validation", async () => {
  const source = await sharp({
    create: {
      width: 30,
      height: 50,
      channels: 3,
      background: "white"
    }
  }).png().toBuffer();

  const parts = await preparePersonalModelValidationParts(source);

  assert.match(parts[0].text ?? "", /PERSONAL MODEL PHOTO TO VALIDATE/);
  assert.match(parts[0].text ?? "", /head through both knees/);
  assert.match(parts[0].text ?? "", /arms may be in any natural position/);
  assert.equal(parts[1].inline_data?.mime_type, "image/jpeg");
  assert.ok(Buffer.from(parts[1].inline_data?.data ?? "", "base64").length > 0);
});

test("rejects bytes that are not a genuine avatar image", async () => {
  const result = await validateAvatarImage(
    Buffer.from("not-an-image"),
    "image/jpeg"
  );

  assert.match(result.error, /genuine JPG, PNG or WEBP image/);
});

test("requires uploaded avatar data for an upload source", async () => {
  const result = await resolveTryOnAvatar({ source: "upload" });

  assert.equal(result.status, 400);
  assert.equal(result.error, "Choose a clear JPG, PNG or WEBP model photo");
});
