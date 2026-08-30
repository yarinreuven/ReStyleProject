import assert from "node:assert/strict";
import test from "node:test";

import {
  savedLookParamsSchema,
  saveOutfitSchema
} from "./outfitValidation.ts";

test("accepts valid IDs when saving and deleting outfits", () => {
  const id = "507f1f77bcf86cd799439011";

  assert.equal(saveOutfitSchema.validate({ selectionId: id }).error, undefined);
  assert.equal(savedLookParamsSchema.validate({ lookId: id }).error, undefined);
});

test("rejects malformed saved outfit IDs", () => {
  assert.match(
    saveOutfitSchema.validate({ selectionId: "invalid" }).error?.details[0].message ?? "",
    /Choose a valid generated look/
  );
  assert.match(
    savedLookParamsSchema.validate({ lookId: "invalid" }).error?.details[0].message ?? "",
    /Choose a valid saved look/
  );
});
