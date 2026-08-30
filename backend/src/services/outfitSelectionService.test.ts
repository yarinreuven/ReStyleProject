import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSupportedWardrobeImage,
  selectNoCostOutfitItems
} from "./outfitSelectionService.ts";

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
