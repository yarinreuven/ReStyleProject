import assert from "node:assert/strict";
import test from "node:test";

import {
  daysSince,
  isAutomaticallyEligibleForRestyle,
  isLessWorn,
  isRecentlyAdded,
  LESS_WORN_DAYS,
  RECENT_DAYS
} from "./wardrobeInsights.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-30T12:00:00.000Z").getTime();

function withFixedNow(callback) {
  const originalNow = Date.now;
  Date.now = () => NOW;
  try {
    callback();
  } finally {
    Date.now = originalNow;
  }
}

test("calculates wardrobe age in complete days", () => {
  withFixedNow(() => {
    assert.equal(daysSince(new Date(NOW - 3 * DAY_IN_MS)), 3);
    assert.equal(daysSince(undefined), Infinity);
  });
});

test("marks an item as less worn at the sixty-day boundary", () => {
  withFixedNow(() => {
    assert.equal(isLessWorn({
      lastWornAt: new Date(NOW - LESS_WORN_DAYS * DAY_IN_MS)
    }), true);
    assert.equal(isLessWorn({
      lastWornAt: new Date(NOW - (LESS_WORN_DAYS - 1) * DAY_IN_MS)
    }), false);
  });
});

test("recognizes only non-future items added during the recent window", () => {
  withFixedNow(() => {
    assert.equal(isRecentlyAdded({
      createdAt: new Date(NOW - RECENT_DAYS * DAY_IN_MS)
    }), true);
    assert.equal(isRecentlyAdded({
      createdAt: new Date(NOW - (RECENT_DAYS + 1) * DAY_IN_MS)
    }), false);
    assert.equal(isRecentlyAdded({ createdAt: new Date(NOW + DAY_IN_MS) }), false);
    assert.equal(isRecentlyAdded({}), false);
  });
});

test("requires an image, an eligible category and low wear for automatic restyling", () => {
  withFixedNow(() => {
    const eligible = {
      image: "data:image/png;base64,image",
      category: "Jackets",
      lastWornAt: new Date(NOW - LESS_WORN_DAYS * DAY_IN_MS)
    };

    assert.equal(isAutomaticallyEligibleForRestyle(eligible), true);
    assert.equal(isAutomaticallyEligibleForRestyle({ ...eligible, image: "" }), false);
    assert.equal(isAutomaticallyEligibleForRestyle({ ...eligible, category: "Shoes" }), false);
    assert.equal(isAutomaticallyEligibleForRestyle({
      ...eligible,
      lastWornAt: new Date(NOW - DAY_IN_MS)
    }), false);
  });
});
