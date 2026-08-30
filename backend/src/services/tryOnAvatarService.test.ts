import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTryOnAvatar,
  validateAvatarImage
} from "./tryOnAvatarService.ts";

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
  assert.equal(result.error, "Choose a full-body JPG, PNG or WEBP image");
});
