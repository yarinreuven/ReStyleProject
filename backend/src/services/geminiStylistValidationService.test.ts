import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAnalyzedWardrobeItem } from "./geminiStylistValidationService.ts";
import { outfitCohesionValidationError } from "./outfitSelectionService.ts";

const itemId = "507f1f77bcf86cd799439011";
const candidateIds = new Set([itemId]);

test("accepts the minimal structured response for valid items", () => {
  const result = normalizeAnalyzedWardrobeItem({
    itemId,
    isValid: true,
    detectedCategory: "Dress",
    eventSuitable: true,
    styleSuitable: true,
    weatherSuitable: true
  }, candidateIds);

  assert.equal(result?.detectedCategory, "Dress");
  assert.equal(result?.eventSuitable, true);
});

test("accepts rejected images without fabricated fashion metadata", () => {
  const result = normalizeAnalyzedWardrobeItem({
    itemId,
    isValid: false,
    detectedCategory: "None",
    eventSuitable: false,
    styleSuitable: false,
    weatherSuitable: false
  }, candidateIds);

  assert.equal(result?.isValid, false);
});

test("still rejects unknown IDs and invalid valid-item categories", () => {
  assert.equal(normalizeAnalyzedWardrobeItem({
    itemId: "507f1f77bcf86cd799439012",
    isValid: false,
    detectedCategory: "None"
  }, candidateIds), null);

  assert.equal(normalizeAnalyzedWardrobeItem({
    itemId,
    isValid: true,
    detectedCategory: "Hat"
  }, candidateIds), null);
});

test("normalizes plural categories", () => {
  const result = normalizeAnalyzedWardrobeItem({
    itemId,
    isValid: true,
    detectedCategory: "Dresses",
    eventSuitable: true,
    styleSuitable: true,
    weatherSuitable: true
  }, candidateIds);

  assert.equal(result?.detectedCategory, "Dress");
});

test("requires the complete look to pass every cohesion check", () => {
  assert.equal(outfitCohesionValidationError({
    colorsCoordinate: true,
    formalityCoordinates: true,
    silhouettesCoordinate: true,
    occasionCoordinates: true
  }), "");

  assert.notEqual(outfitCohesionValidationError({
    colorsCoordinate: true,
    formalityCoordinates: false,
    silhouettesCoordinate: true,
    occasionCoordinates: true
  }), "");
});
