import assert from "node:assert/strict";
import test from "node:test";

import { paypalOrderParamsSchema, paypalPlanSchema } from "./paypalValidation.ts";

test("accepts supported PayPal products and plans", () => {
  assert.equal(paypalPlanSchema.validate({ plan: "mini", product: "tryon" }).error, undefined);
  assert.equal(paypalPlanSchema.validate({ plan: "style", product: "restyle" }).error, undefined);
});

test("rejects unknown PayPal products and plans", () => {
  assert.ok(paypalPlanSchema.validate({ plan: "premium", product: "tryon" }).error);
  assert.ok(paypalPlanSchema.validate({ plan: "mini", product: "marketplace" }).error);
});

test("accepts PayPal order IDs only in the expected format", () => {
  assert.equal(paypalOrderParamsSchema.validate({ orderId: "5O190127TN364715T" }).error, undefined);
  assert.ok(paypalOrderParamsSchema.validate({ orderId: "bad/order" }).error);
});
