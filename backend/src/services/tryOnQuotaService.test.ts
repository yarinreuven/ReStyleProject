import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTryOnRequestKey,
  finalizeQuotaState,
  FREE_TRY_ON_LIMIT,
  refundQuotaState,
  reserveQuotaState,
  TRY_ON_RESERVATION_TTL_MS,
  type TestableQuotaState
} from "./tryOnQuotaService.ts";
import {
  existingTryOnAction,
  hasForbiddenTryOnOverrides
} from "./tryOnValidationService.ts";

const empty = (credits = 0): TestableQuotaState => ({
  freeTryOnsUsed: 0,
  tryOnCredits: credits,
  reservations: [],
  completedRequestKeys: []
});

test("three successes consume the lifetime free allowance and a fourth is blocked", () => {
  let state = empty();
  assert.equal(state.freeTryOnsUsed, 0);
  for (let index = 1; index <= FREE_TRY_ON_LIMIT; index += 1) {
    const reserved = reserveQuotaState(state, `token-${index}`, new Date());
    assert.ok(reserved);
    state = finalizeQuotaState(reserved.state, `token-${index}`, `request-${index}`);
    assert.equal(state.freeTryOnsUsed, index);
    assert.equal(FREE_TRY_ON_LIMIT - state.freeTryOnsUsed, FREE_TRY_ON_LIMIT - index);
  }
  assert.equal(reserveQuotaState(state, "fourth", new Date()), null);
});

test("failure and double refund do not consume quota", () => {
  const reserved = reserveQuotaState(empty(), "failed", new Date());
  assert.ok(reserved);
  const refunded = refundQuotaState(refundQuotaState(reserved.state, "failed"), "failed");
  assert.equal(refunded.freeTryOnsUsed, 0);
  assert.equal(refunded.reservations.length, 0);
});

test("parallel reservations cannot exceed the three free slots", () => {
  let state = empty();
  for (let index = 0; index < 3; index += 1) {
    const reservation = reserveQuotaState(state, `parallel-${index}`, new Date());
    assert.ok(reservation);
    state = reservation.state;
  }
  assert.equal(reserveQuotaState(state, "parallel-4", new Date()), null);
  assert.equal(empty().reservations.length, 0);
});

test("cached success is idempotent and stale reservations are released", () => {
  const now = new Date();
  const first = reserveQuotaState(empty(), "one", now);
  assert.ok(first);
  const succeeded = finalizeQuotaState(first.state, "one", "same-request");
  assert.deepEqual(finalizeQuotaState(succeeded, "one", "same-request"), succeeded);
  const staleState: TestableQuotaState = {
    ...empty(),
    reservations: [{
      token: "stale",
      type: "free",
      createdAt: new Date(now.getTime() - TRY_ON_RESERVATION_TTL_MS - 1)
    }]
  };
  const replacement = reserveQuotaState(staleState, "new", now);
  assert.ok(replacement);
  assert.deepEqual(replacement.state.reservations.map((entry) => entry.token), ["new"]);
});

test("credits are reserved after free quota and charged once on success", () => {
  const state = { ...empty(1), freeTryOnsUsed: 3 };
  const reserved = reserveQuotaState(state, "credit", new Date());
  assert.ok(reserved);
  assert.equal(reserved.type, "credit");
  assert.equal(reserved.state.tryOnCredits, 1);
  const succeeded = finalizeQuotaState(reserved.state, "credit", "credit-request");
  assert.equal(succeeded.tryOnCredits, 0);
  assert.equal(finalizeQuotaState(succeeded, "credit", "credit-request").tryOnCredits, 0);
  assert.equal(reserveQuotaState(succeeded, "negative", new Date()), null);
});

test("request keys include avatar identity and client quota overrides are rejected", () => {
  const base = { userId: "u", selectionId: "s", avatarSource: "upload", avatarIdentity: "a" };
  assert.equal(buildTryOnRequestKey(base), buildTryOnRequestKey(base));
  assert.notEqual(buildTryOnRequestKey(base), buildTryOnRequestKey({ ...base, avatarIdentity: "b" }));
  assert.equal(hasForbiddenTryOnOverrides({ tryOnCredits: 100 }), true);
  assert.equal(hasForbiddenTryOnOverrides({ subscriptionPlan: "style" }), true);
});

test("an identical pending request stays in progress and failed work may retry", () => {
  const now = new Date();
  assert.equal(existingTryOnAction("pending", now, now, TRY_ON_RESERVATION_TTL_MS), "in-progress");
  assert.equal(existingTryOnAction("succeeded", now, now, TRY_ON_RESERVATION_TTL_MS), "cache");
  assert.equal(existingTryOnAction("failed", now, now, TRY_ON_RESERVATION_TTL_MS), "retry");
});
