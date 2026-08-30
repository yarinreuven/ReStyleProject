import assert from "node:assert/strict";
import test from "node:test";

import {
  validateForgotPasswordEmail,
  validateResetPassword
} from "./passwordResetValidation.js";

const validToken = "a".repeat(64);

test("normalizes a valid password reset email", () => {
  assert.deepEqual(
    validateForgotPasswordEmail("  USER@Example.COM "),
    { email: "user@example.com", error: "" }
  );
});

test("rejects empty and malformed password reset emails", () => {
  assert.equal(validateForgotPasswordEmail(" ").error, "Email is required");
  assert.equal(
    validateForgotPasswordEmail("missing-domain@").error,
    "Please enter a valid email address"
  );
});

test("rejects missing and malformed reset tokens", () => {
  const form = { newPassword: "secret", confirmPassword: "secret" };
  assert.equal(validateResetPassword("", form), "This password reset link is invalid.");
  assert.equal(validateResetPassword("not-hex", form), "This password reset link is invalid.");
});

test("enforces password length boundaries", () => {
  assert.equal(
    validateResetPassword(validToken, { newPassword: "12345", confirmPassword: "12345" }),
    "Password must contain at least 6 characters."
  );
  const longPassword = "x".repeat(101);
  assert.equal(
    validateResetPassword(validToken, { newPassword: longPassword, confirmPassword: longPassword }),
    "Password cannot contain more than 100 characters."
  );
});

test("requires a matching confirmation password", () => {
  assert.equal(
    validateResetPassword(validToken, { newPassword: "secret", confirmPassword: "" }),
    "Please confirm your new password."
  );
  assert.equal(
    validateResetPassword(validToken, { newPassword: "secret", confirmPassword: "different" }),
    "Passwords do not match."
  );
});

test("accepts a valid reset token and matching password", () => {
  assert.equal(
    validateResetPassword(validToken, { newPassword: "secret", confirmPassword: "secret" }),
    ""
  );
});
