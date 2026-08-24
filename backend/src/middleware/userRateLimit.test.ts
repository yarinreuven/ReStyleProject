import assert from "node:assert/strict";
import test from "node:test";

import { createUserRateLimit, UserSlidingWindowRateLimiter } from "./userRateLimit.ts";

test("limits each authenticated user independently", () => {
  const limiter = new UserSlidingWindowRateLimiter(3, 10 * 60 * 1000);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(limiter.consume("user-a", index).allowed, true);
  }
  const blocked = limiter.consume("user-a", 3);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(limiter.consume("user-b", 3).allowed, true);
});

test("allows requests again after the sliding window expires", () => {
  const windowMs = 1000;
  const limiter = new UserSlidingWindowRateLimiter(1, windowMs);
  assert.equal(limiter.consume("user", 100).allowed, true);
  assert.equal(limiter.consume("user", 200).allowed, false);
  assert.equal(limiter.consume("user", 1101).allowed, true);
});

test("middleware returns a distinct 429 code and Retry-After header", () => {
  const middleware = createUserRateLimit({
    maxRequests: 1,
    windowMs: 60_000,
    code: "TEST_RATE_LIMITED",
    message: "Please wait."
  });
  const request = { userId: "user" } as never;
  let nextCalls = 0;
  const responseState: { status?: number; body?: unknown; retryAfter?: string } = {};
  const response = {
    setHeader: (_name: string, value: string) => { responseState.retryAfter = value; },
    status: (status: number) => {
      responseState.status = status;
      return { json: (body: unknown) => { responseState.body = body; } };
    }
  } as never;
  middleware(request, response, () => { nextCalls += 1; });
  middleware(request, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(responseState.status, 429);
  assert.deepEqual(responseState.body, {
    success: false,
    code: "TEST_RATE_LIMITED",
    message: "Please wait."
  });
  assert.ok(Number(responseState.retryAfter) > 0);
});
