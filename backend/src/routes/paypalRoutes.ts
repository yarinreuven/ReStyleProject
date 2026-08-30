import { Router } from "express";

import {
  captureOrder,
  createOrder,
  getPayPalConfig,
  handlePayPalWebhook
} from "../controllers/paypalController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  paypalOrderParamsSchema,
  paypalPlanSchema
} from "../validation/paypalValidation.ts";

const router = Router();

router.post("/webhook", handlePayPalWebhook);
router.use(authenticateToken);
router.get("/config", getPayPalConfig);
router.post("/orders", validate(paypalPlanSchema), createOrder);
router.post(
  "/orders/:orderId/capture",
  validateParams(paypalOrderParamsSchema),
  captureOrder
);

export default router;
