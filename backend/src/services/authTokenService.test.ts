import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

import { ACCESS_TOKEN_TTL, createAccessToken, readRefreshCookie } from "./authTokenService.ts";

test("access tokens expire after fifteen minutes", () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-that-is-only-used-by-unit-tests";
  try {
    const token = createAccessToken("507f1f77bcf86cd799439011", "test@example.com");
    const payload = jwt.decode(token) as jwt.JwtPayload;
    assert.equal(ACCESS_TOKEN_TTL, "15m");
    assert.equal((payload.exp || 0) - (payload.iat || 0), 15 * 60);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test("refresh tokens are read only from the dedicated cookie", () => {
  const request = {
    headers: { cookie: "theme=light; restyle_refresh=protected-token; other=value" }
  } as any;
  assert.equal(readRefreshCookie(request), "protected-token");
});
