import assert from "node:assert/strict";
import test from "node:test";

import {
  createItemSchema,
  itemIdParamsSchema,
  updateFavoriteSchema,
  updateItemSchema
} from "./itemValidation.ts";

test("accepts and normalizes a complete wardrobe item", () => {
  const { error, value } = createItemSchema.validate({
    name: "  Linen shirt  ",
    category: "Tops",
    color: "White",
    season: "Summer",
    style: "Casual",
    favorite: "true"
  });

  assert.equal(error, undefined);
  assert.equal(value.name, "Linen shirt");
  assert.equal(value.favorite, true);
});

test("rejects invalid wardrobe enums and malformed item IDs", () => {
  assert.ok(createItemSchema.validate({
    name: "Shirt",
    category: "Unknown",
    color: "White",
    season: "Summer",
    style: "Casual"
  }).error);
  assert.ok(itemIdParamsSchema.validate({ id: "not-an-object-id" }).error);
});

test("supports partial item updates and requires a boolean favorite", () => {
  assert.equal(updateItemSchema.validate({ color: "Navy" }).error, undefined);
  assert.ok(updateFavoriteSchema.validate({ favorite: "sometimes" }).error);
});
