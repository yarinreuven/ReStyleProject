import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  buildGeminiStylistPrompt,
  buildGeminiWardrobeImageParts,
  geminiStylistFailureMessage,
  GEMINI_STYLIST_RESPONSE_SCHEMA,
  isCompleteStylistSuggestion,
  isValidStylistSelection,
  isNoCostAiMockMode,
  isSafeStylistText,
  parseGeminiStylistSuggestion,
  requestGeminiStylist
} from "./geminiStylistService.ts";

test("builds the stylist prompt with the request, wardrobe and avatar rules", () => {
  const request = { event: "Work", avatarSource: "personal" };
  const wardrobe = [{ itemId: "item-123", category: "Tops" }];
  const personalPrompt = buildGeminiStylistPrompt(request, wardrobe, "personal");
  const presetPrompt = buildGeminiStylistPrompt(
    { ...request, avatarSource: "preset" },
    wardrobe,
    "preset"
  );

  assert.match(personalPrompt, /PERSONAL MODEL PHOTO/);
  assert.match(personalPrompt, /"event":"Work"/);
  assert.match(personalPrompt, /"itemId":"item-123"/);
  assert.match(presetPrompt, /No personal model photo was requested/);
  assert.doesNotMatch(presetPrompt, /PERSONAL MODEL PHOTO/);
});

test("accepts only safe stylist selections with valid MongoDB IDs", () => {
  const valid = {
    itemId: "507f1f77bcf86cd799439011",
    detectedCategory: "Top" as const,
    reason: "Matches the requested event"
  };

  assert.equal(isValidStylistSelection(valid), true);
  assert.equal(isValidStylistSelection({ ...valid, itemId: "invalid" }), false);
  assert.equal(isValidStylistSelection({ ...valid, reason: "Buy this top" }), false);
});

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

test("parses only complete Gemini stylist responses", () => {
  const completeSuggestion = {
    title: "Work look",
    explanation: "The pieces coordinate.",
    analyzedItems: [{}],
    selectedItems: [],
    cohesion: {
      colorsCoordinate: true,
      formalityCoordinates: true,
      silhouettesCoordinate: true,
      occasionCoordinates: true,
      reason: "The look is cohesive."
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
  };

  const missing = parseGeminiStylistSuggestion(undefined, 1);
  const invalidJson = parseGeminiStylistSuggestion("not-json", 1);
  const incomplete = parseGeminiStylistSuggestion(
    JSON.stringify(completeSuggestion),
    2
  );

  assert.equal("reason" in missing ? missing.reason : undefined, "missing");
  assert.equal("reason" in invalidJson ? invalidJson.reason : undefined, "invalid-json");
  assert.equal("reason" in incomplete ? incomplete.reason : undefined, "incomplete");
  assert.equal(
    parseGeminiStylistSuggestion(JSON.stringify(completeSuggestion), 1).success,
    true
  );
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
