import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAllowedOrigins,
  resolveFrontendUrl
} from "./frontendConfigService.ts";

test("allows local frontend origins only outside production", () => {
  const development = resolveAllowedOrigins(undefined, "development");
  assert.ok(development.includes("http://localhost:5173"));
  assert.ok(development.includes("http://127.0.0.1:5173"));

  assert.deepEqual(
    resolveAllowedOrigins("https://restyle.example.com/", "production"),
    ["https://restyle.example.com"]
  );
});

test("requires an explicit frontend URL in production", () => {
  assert.throws(
    () => resolveFrontendUrl(undefined, "production"),
    /FRONTEND_URL is required/
  );
  assert.throws(
    () => resolveAllowedOrigins("", "production"),
    /FRONTEND_URL is required/
  );
  assert.equal(resolveFrontendUrl(undefined, "test"), "http://localhost:5173");
});
