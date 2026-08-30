import assert from "node:assert/strict";
import test from "node:test";

import { userIdParamsSchema } from "./authValidation.ts";

test("accepts a valid user route ID", () => {
  const result = userIdParamsSchema.validate({
    userId: "507f1f77bcf86cd799439011"
  });

  assert.equal(result.error, undefined);
});

test("rejects a malformed user route ID", () => {
  const result = userIdParamsSchema.validate({ userId: "invalid" });

  assert.equal(result.error?.details[0].message, "Invalid user ID");
});
