import assert from "node:assert/strict";
import test from "node:test";

import { authorizationConfig } from "./apiConfig.js";

test("creates the bearer authorization header used by API requests", () => {
  assert.deepEqual(authorizationConfig("access-token"), {
    headers: { Authorization: "Bearer access-token" }
  });
});
