import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  buildGeminiWardrobeImageParts,
  geminiStylistFailureMessage,
  GEMINI_STYLIST_RESPONSE_SCHEMA,
  isCompleteStylistSuggestion,
  isNoCostAiMockMode,
  isSafeStylistText,
  requestGeminiStylist
} from "./geminiStylistService.ts";

test("maps Gemini provider failures to safe user-facing messages", () => {
  assert.match(geminiStylistFailureMessage(429), /allowance/);
  assert.match(geminiStylistFailureMessage(401), /access was rejected/);
  assert.match(geminiStylistFailureMessage(413), /too large/);
  assert.match(geminiStylistFailureMessage(500), /could not be inspected/);
});

test("accepts only complete and safe stylist suggestions", () => {
  const suggestion = {
    title: "Evening look",
    explanation: "The colors and silhouettes coordinate.",
    analyzedItems: [{}],
    selectedItems: [],
    cohesion: {
      colorsCoordinate: true,
      formalityCoordinates: true,
      silhouettesCoordinate: true,
      occasionCoordinates: true,
      reason: "The complete outfit works together."
    },
    stylingTips: ["Wear the jacket open."],
    avatarValidation: {
      valid: true,
      singlePerson: true,
      fullBodyVisible: true,
      frontFacing: true,
      faceClear: true,
      reason: "Preset avatar"
    }
  } as Parameters<typeof isCompleteStylistSuggestion>[0];

  assert.equal(isCompleteStylistSuggestion(suggestion, 1), true);
  assert.equal(isCompleteStylistSuggestion(suggestion, 2), false);
  assert.equal(isCompleteStylistSuggestion({
    ...suggestion,
    stylingTips: ["Buy a new bag"]
  }, 1), false);
});

test("optimizes wardrobe images and preserves their internal item IDs", async () => {
  const sourceImage = await sharp({
    create: {
      width: 20,
      height: 30,
      channels: 3,
      background: "white"
    }
  }).png().toBuffer();

  const parts = await buildGeminiWardrobeImageParts([{
    id: "item-123",
    item: { category: "Tops", image: { data: sourceImage } }
  }]);

  assert.match(parts[0].text ?? "", /item-123/);
  assert.match(parts[0].text ?? "", /Tops/);
  assert.equal(parts[1].inline_data?.mime_type, "image/jpeg");
  assert.ok(Buffer.from(parts[1].inline_data?.data ?? "", "base64").length > 0);
});

test("never enables stylist mock mode in production", () => {
  const previousEnv = process.env.NODE_ENV;
  const previousFlag = process.env.RESTYLE_AI_MOCK_MODE;
  process.env.NODE_ENV = "production";
  process.env.RESTYLE_AI_MOCK_MODE = "1";

  try {
    assert.equal(isNoCostAiMockMode(), false);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
    if (previousFlag === undefined) delete process.env.RESTYLE_AI_MOCK_MODE;
    else process.env.RESTYLE_AI_MOCK_MODE = previousFlag;
  }
});

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
