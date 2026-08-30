import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarketplaceItemSchema,
  marketplaceAvailabilitySchema,
  marketplaceItemIdSchema
} from "./marketplaceValidation.ts";

const validListing = {
  name: "Linen blazer",
  listingType: "sale",
  price: 120,
  rentalPricePerDay: null,
  size: "M",
  condition: "Excellent",
  category: "Jackets",
  brand: "ReStyle",
  description: "A lightweight linen blazer in excellent condition."
};

test("accepts a complete marketplace sale listing", () => {
  const { error, value } = createMarketplaceItemSchema.validate(validListing);
  assert.equal(error, undefined);
  assert.equal(value.price, 120);
  assert.equal(value.availabilityStatus, "active");
});

test("requires the price that matches the listing type", () => {
  assert.ok(createMarketplaceItemSchema.validate({ ...validListing, price: null }).error);
  assert.ok(createMarketplaceItemSchema.validate({
    ...validListing,
    listingType: "rent",
    price: null,
    rentalPricePerDay: null
  }).error);
});

test("rejects invalid marketplace IDs and availability values", () => {
  assert.ok(marketplaceItemIdSchema.validate({ id: "invalid" }).error);
  assert.ok(marketplaceAvailabilitySchema.validate({ availabilityStatus: "sold" }).error);
});
