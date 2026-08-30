import assert from "node:assert/strict";
import test from "node:test";

import { buildTryOnGenerationParts, type OutfitImageInput } from "./geminiTryOnService.ts";
import { isTryOnQuotaBypassEnabled } from "./tryOnQuotaService.ts";
import {
  hasForbiddenTryOnOverrides,
  tryOnRequestValidationError,
  generatedImageAcceptedForUserReview,
  qualityValidationError,
  resourceOwnershipError,
  validateTryOnComposition,
  type TryOnItemDescriptor,
  type TryOnQualityResult
} from "./tryOnValidationService.ts";

test("validates the saved selection request before virtual try-on", () => {
  assert.equal(tryOnRequestValidationError({
    selectionId: "507f1f77bcf86cd799439011"
  }), "");
  assert.equal(tryOnRequestValidationError({
    selectionId: "invalid"
  }), "Choose a valid saved outfit");
  assert.equal(tryOnRequestValidationError({
    selectionId: "507f1f77bcf86cd799439011",
    tryOnCredits: 100
  }), "The try-on must use the saved verified outfit selection");
});

const item = (detectedCategory: OutfitImageInput["detectedCategory"]): OutfitImageInput => ({
  itemId: detectedCategory.toLowerCase(),
  name: detectedCategory,
  detectedCategory,
  data: Buffer.from(detectedCategory),
  contentType: "image/png"
});
const descriptor = (detectedCategory: OutfitImageInput["detectedCategory"]): TryOnItemDescriptor => ({
  itemId: detectedCategory.toLowerCase(),
  detectedCategory
});
const validQuality = (): TryOnQualityResult => ({
  valid: true,
  fullBodyVisible: true,
  facePreserved: true,
  baseOutfitPresent: true,
  exactGarmentsMatchReferences: true,
  jacketPresent: true,
  shoesPresent: true,
  bagPresent: true,
  accessoryPresent: true,
  unexpectedItemsDetected: false,
  failureReasons: []
});

test("quota bypass is explicit and can never run in production", () => {
  assert.equal(isTryOnQuotaBypassEnabled("development", "1"), true);
  assert.equal(isTryOnQuotaBypassEnabled("test", "1"), true);
  assert.equal(isTryOnQuotaBypassEnabled("production", "1"), false);
  assert.equal(isTryOnQuotaBypassEnabled("development", undefined), false);
});

test("a structurally valid generated image can be shown without a second AI call", () => {
  const result = generatedImageAcceptedForUserReview([
    descriptor("Dress"), descriptor("Shoes"), descriptor("Bag")
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.unexpectedItemsDetected, false);
  assert.deepEqual(result.failureReasons, []);
});

test("all selected optional pieces are included in the Gemini request without a network call", () => {
  const items = [item("Top"), item("Bottom"), item("Jacket"), item("Shoes"), item("Bag"), item("Accessory")];
  const parts = buildTryOnGenerationParts(Buffer.from("avatar"), "image/png", items);
  const text = parts.flatMap((part) => "text" in part ? [part.text] : []).join("\n");
  for (const selected of items) assert.match(text, new RegExp(`detectedCategory=${selected.detectedCategory}`));
  assert.match(text, /Jacket must be the outermost clothing layer/);
});

test("composition permits Dress alone or Top and Bottom together", () => {
  assert.equal(validateTryOnComposition([descriptor("Dress")]), "");
  assert.equal(validateTryOnComposition([descriptor("Top"), descriptor("Bottom")]), "");
  assert.notEqual(validateTryOnComposition([descriptor("Dress"), descriptor("Top")]), "");
  assert.notEqual(validateTryOnComposition([descriptor("Top")]), "");
});

test("quality validation keeps a valid outfit when only optional accessories differ", () => {
  const selected = [descriptor("Top"), descriptor("Bottom"), descriptor("Shoes"), descriptor("Bag"), descriptor("Accessory")];
  for (const field of ["shoesPresent", "bagPresent", "accessoryPresent"] as const) {
    const quality = validQuality();
    quality[field] = false;
    assert.equal(qualityValidationError(quality, selected), "");
  }
  const unexpected = validQuality();
  unexpected.unexpectedItemsDetected = true;
  assert.equal(qualityValidationError(unexpected, selected), "");
});

test("ownership and client-controlled fields are rejected generically", () => {
  const foreignSelection = resourceOwnershipError({
    userId: "a",
    selectionOwnerId: "b",
    selectedItemIds: [],
    items: []
  });
  const foreignItem = resourceOwnershipError({
    userId: "a",
    selectionOwnerId: "a",
    selectedItemIds: ["item"],
    items: [{ itemId: "item", ownerId: "b" }]
  });
  assert.deepEqual(foreignSelection, { status: 403, message: "You cannot use this saved outfit" });
  assert.deepEqual(foreignItem, foreignSelection);
  for (const field of ["detectedCategory", "userId", "owner", "tryOnCredits", "subscriptionPlan"]) {
    assert.equal(hasForbiddenTryOnOverrides({ [field]: "forged" }), true);
  }
});
