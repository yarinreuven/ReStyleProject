import assert from "node:assert/strict";
import test from "node:test";

import { uploadSizeMessage } from "./errorHandler.ts";

test("reports the ten megabyte wardrobe image limit", () => {
  assert.equal(uploadSizeMessage("image"), "Image must be smaller than 10MB");
});

test("reports the five megabyte limit for other image uploads", () => {
  assert.equal(uploadSizeMessage("images"), "Image must be smaller than 5MB");
  assert.equal(uploadSizeMessage("profileImage"), "Image must be smaller than 5MB");
});
