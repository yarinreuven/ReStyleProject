import assert from "node:assert/strict";
import test from "node:test";

import {
  isPersonalAvatarAcceptable,
  normalizeAnalyzedWardrobeItem,
  normalizeCompleteWardrobeAnalysis,
  normalizeSelectedOutfitItems
} from "./geminiStylistValidationService.ts";
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

test("requires one normalized analysis for every candidate ID", () => {
  const secondId = "507f1f77bcf86cd799439012";
  const ids = new Set([itemId, secondId]);
  const validAnalysis = (id: string) => ({
    itemId: id,
    isValid: true,
    detectedCategory: "Top",
    eventSuitable: true,
    styleSuitable: true,
    weatherSuitable: true
  });

  const complete = normalizeCompleteWardrobeAnalysis([
    validAnalysis(itemId),
    validAnalysis(secondId)
  ], ids);
  assert.equal(complete?.analyses.length, 2);
  assert.equal(complete?.byId.get(secondId)?.detectedCategory, "Top");

  assert.equal(normalizeCompleteWardrobeAnalysis([
    validAnalysis(itemId)
  ], ids), null);
  assert.equal(normalizeCompleteWardrobeAnalysis([
    validAnalysis(itemId),
    validAnalysis(itemId)
  ], ids), null);
});

test("normalizes selected categories and rejects None selections", () => {
  assert.deepEqual(normalizeSelectedOutfitItems([{
    itemId,
    detectedCategory: "Dresses" as "Dress",
    reason: "Suitable for the event"
  }]), [{
    itemId,
    detectedCategory: "Dress",
    reason: "Suitable for the event"
  }]);

  assert.equal(normalizeSelectedOutfitItems([{
    itemId,
    detectedCategory: "None" as "Dress",
    reason: "Invalid selection"
  }]), null);
});

test("does not reject a full-body avatar only because the face is small in frame", () => {
  assert.equal(isPersonalAvatarAcceptable({
    valid: false,
    singlePerson: true,
    fullBodyVisible: true,
    frontFacing: true,
    faceClear: false
  }), true);
});

test("still rejects cropped, side-facing and group avatar photos", () => {
  assert.equal(isPersonalAvatarAcceptable({
    singlePerson: true,
    fullBodyVisible: false,
    frontFacing: true
  }), false);
  assert.equal(isPersonalAvatarAcceptable({
    singlePerson: true,
    fullBodyVisible: true,
    frontFacing: false
  }), false);
  assert.equal(isPersonalAvatarAcceptable({
    singlePerson: false,
    fullBodyVisible: true,
    frontFacing: true
  }), false);
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
