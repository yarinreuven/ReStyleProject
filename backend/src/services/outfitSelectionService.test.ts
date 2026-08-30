import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVerifiedCandidates,
  hasSupportedWardrobeImage,
  hasCompleteAnalyzedOutfitBase,
  selectNoCostOutfitItems
} from "./outfitSelectionService.ts";

test("builds verified candidates only from valid wardrobe analyses", () => {
  const analyses = new Map([
    ["owned", {
      isValid: true,
      detectedCategory: "Top" as const,
      eventSuitable: true,
      styleSuitable: true,
      weatherSuitable: false
    }],
    ["invalid", {
      isValid: false,
      detectedCategory: "None" as const,
      eventSuitable: false,
      styleSuitable: false,
      weatherSuitable: false
    }],
    ["missing", {
      isValid: true,
      detectedCategory: "Bottom" as const,
      eventSuitable: true,
      styleSuitable: true,
      weatherSuitable: true
    }]
  ]);
  const items = new Map([
    ["owned", { image: { data: Buffer.from("image"), contentType: "image/png" } }]
  ]);

  const result = buildVerifiedCandidates(
    [{ id: "owned" }, { id: "invalid" }, { id: "missing" }],
    analyses,
    items
  );

  assert.deepEqual(result.get("owned"), {
    ownerVerified: true,
    hasValidImage: true,
    detectedCategory: "Top",
    eventSuitable: true,
    styleSuitable: true,
    weatherSuitable: false
  });
  assert.equal(result.has("invalid"), false);
  assert.deepEqual(result.get("missing"), {
    ownerVerified: false,
    hasValidImage: false,
    detectedCategory: "Bottom",
    eventSuitable: true,
    styleSuitable: true,
    weatherSuitable: true
  });
});

test("requires a dress or both a top and bottom in analyzed wardrobe items", () => {
  assert.equal(hasCompleteAnalyzedOutfitBase([
    { isValid: true, detectedCategory: "Dress" }
  ]), true);
  assert.equal(hasCompleteAnalyzedOutfitBase([
    { isValid: true, detectedCategory: "Top" },
    { isValid: true, detectedCategory: "Bottom" }
  ]), true);
  assert.equal(hasCompleteAnalyzedOutfitBase([
    { isValid: true, detectedCategory: "Top" },
    { isValid: false, detectedCategory: "None" }
  ]), false);
});

test("accepts only supported non-empty wardrobe images", () => {
  assert.equal(hasSupportedWardrobeImage({
    image: { data: Buffer.from("image"), contentType: "image/jpeg" }
  }), true);
  assert.equal(hasSupportedWardrobeImage({
    image: { data: Buffer.from("image"), contentType: "image/gif" }
  }), false);
  assert.equal(hasSupportedWardrobeImage({
    image: { data: Buffer.alloc(0), contentType: "image/png" }
  }), false);
  assert.equal(hasSupportedWardrobeImage({}), false);
});

test("builds a deterministic no-cost look from a dress and optional pieces", () => {
  const result = selectNoCostOutfitItems([
    { id: "dress", category: "Dresses" },
    { id: "top", category: "Tops" },
    { id: "shoes", category: "Shoes" },
    { id: "bag", category: "Bags" }
  ]);

  assert.deepEqual(
    result.map(({ item, detectedCategory }) => [item.id, detectedCategory]),
    [["dress", "Dress"], ["shoes", "Shoes"], ["bag", "Bag"]]
  );
});

test("uses top and bottom when there is no dress", () => {
  const result = selectNoCostOutfitItems([
    { id: "top", category: "Tops" },
    { id: "bottom", category: "Bottoms" },
    { id: "jacket", category: "Jackets" }
  ]);

  assert.deepEqual(
    result.map(({ detectedCategory }) => detectedCategory),
    ["Top", "Bottom", "Jacket"]
  );
});

test("returns no no-cost look without a complete base", () => {
  assert.deepEqual(
    selectNoCostOutfitItems([{ id: "top", category: "Tops" }]),
    []
  );
});
