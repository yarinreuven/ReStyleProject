import assert from "node:assert/strict";
import test from "node:test";

import { isAuthLifecycleRequest } from "./authRequest.js";

test("recognizes every public authentication lifecycle request", () => {
  const authUrl = "/api/auth";
  for (const endpoint of [
    "refresh",
    "login",
    "register",
    "google",
    "logout",
    "forgot-password",
    "reset-password"
  ]) {
    assert.equal(isAuthLifecycleRequest(`${authUrl}/${endpoint}`, authUrl), true);
  }
});

test("supports absolute API URLs and ignores query strings", () => {
  const authUrl = "https://api.restyle.example/api/auth";
  assert.equal(
    isAuthLifecycleRequest(`${authUrl}/reset-password?source=email`, authUrl),
    true
  );
});

test("keeps protected and similarly named requests eligible for refresh", () => {
  const authUrl = "/api/auth";
  assert.equal(isAuthLifecycleRequest(`${authUrl}/me`, authUrl), false);
  assert.equal(isAuthLifecycleRequest(`${authUrl}/blocked-users`, authUrl), false);
  assert.equal(isAuthLifecycleRequest(`${authUrl}/login-history`, authUrl), false);
});
