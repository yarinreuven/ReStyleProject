import assert from "node:assert/strict";
import test from "node:test";

import { scaledImageDimensions } from "./imageUpload.js";

test("bounds landscape and portrait uploads without changing aspect ratio", () => {
  assert.deepEqual(scaledImageDimensions(3200, 1600), { width: 1600, height: 800 });
  assert.deepEqual(scaledImageDimensions(1200, 2400), { width: 800, height: 1600 });
});

test("does not enlarge images that already fit the upload boundary", () => {
  assert.deepEqual(scaledImageDimensions(600, 900), { width: 600, height: 900 });
});
