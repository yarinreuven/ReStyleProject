import assert from "node:assert/strict";
import test from "node:test";

import User from "./User.ts";

test("excludes password hashes from ordinary user queries", () => {
  const passwordPath = User.schema.path("password");

  assert.equal(passwordPath.options.select, false);
});
