import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountDeletionFilters } from "./accountDeletionService.ts";

test("account deletion covers user favorites, conversations and references to owned items", () => {
  const itemIds = ["item-a", "item-b"];
  const filters = buildAccountDeletionFilters("user-a", itemIds);

  assert.deepEqual(filters.favorites, {
    $or: [{ user: "user-a" }, { item: { $in: itemIds } }]
  });
  assert.deepEqual(filters.conversations, {
    $or: [{ participants: "user-a" }, { item: { $in: itemIds } }]
  });
});

test("account deletion produces valid filters for a user without wardrobe items", () => {
  const filters = buildAccountDeletionFilters("user-a", []);
  assert.deepEqual(filters.favorites, { $or: [{ user: "user-a" }] });
  assert.deepEqual(filters.conversations, { $or: [{ participants: "user-a" }] });
});
