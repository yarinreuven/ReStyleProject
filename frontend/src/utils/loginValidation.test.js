import assert from "node:assert/strict";
import test from "node:test";

import { validateLoginValues } from "./loginValidation.js";

test("requires both login fields", () => {
  const result = validateLoginValues({ email: "", password: "" });
  assert.equal(result.errors.email, "Please enter your email.");
  assert.equal(result.errors.password, "Please enter your password.");
});

test("rejects malformed login email addresses", () => {
  const result = validateLoginValues({ email: "not-an-email", password: "secret" });
  assert.equal(result.errors.email, "Please enter a valid email address.");
  assert.equal(result.errors.password, undefined);
});

test("normalizes a valid login email without changing the password", () => {
  const values = { email: "  USER@Example.COM ", password: " secret value " };
  const result = validateLoginValues(values);
  assert.equal(result.email, "user@example.com");
  assert.deepEqual(result.errors, {});
  assert.equal(values.password, " secret value ");
});
