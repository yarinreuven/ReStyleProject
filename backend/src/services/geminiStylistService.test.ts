import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_STYLIST_RESPONSE_SCHEMA,
  isSafeStylistText,
  requestGeminiStylist
} from "./geminiStylistService.ts";

test("keeps the stylist response schema constrained to detected categories", () => {
  const selectedCategory = GEMINI_STYLIST_RESPONSE_SCHEMA
    .properties.selectedItems.items.properties.detectedCategory;

  const allowedCategories: readonly string[] = selectedCategory.enum;
  assert.ok(allowedCategories.includes("Top"));
  assert.equal(allowedCategories.includes("None"), false);
});

test("rejects empty, shopping and linked stylist text", () => {
  assert.equal(isSafeStylistText("Wear the jacket with neutral trousers"), true);
  assert.equal(isSafeStylistText(""), false);
  assert.equal(isSafeStylistText("Buy this look"), false);
  assert.equal(isSafeStylistText("See https://example.com"), false);
});

test("rejects an oversized stylist payload before making a network request", async () => {
  await assert.rejects(
    requestGeminiStylist("test-key", { content: "x".repeat(18 * 1024 * 1024) }),
    /GEMINI_STYLIST_PAYLOAD_TOO_LARGE/
  );
});
