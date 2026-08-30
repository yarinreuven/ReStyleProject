import express from "express";

import {
  createTryOn,
  generateOutfit,
  getTryOnStatus
} from "../controllers/outfitController.ts";
import {
  deleteSavedOutfit,
  getSavedOutfits,
  saveOutfit
} from "../controllers/savedOutfitController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { createUserRateLimit } from "../middleware/userRateLimit.ts";
import { tryOnImageUpload } from "../middleware/tryOnUpload.ts";
import { validateTryOnRequest } from "../middleware/validateTryOnRequest.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  outfitRequestSchema,
  savedLookParamsSchema,
  saveOutfitSchema
} from "../validation/outfitValidation.ts";

const router = express.Router();
const generateRateLimit = createUserRateLimit({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  code: "OUTFIT_GENERATE_RATE_LIMITED",
  message: "You are creating looks too quickly. Please wait a few minutes and try again."
});
const tryOnRateLimit = createUserRateLimit({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
  code: "TRY_ON_RATE_LIMITED",
  message: "You are creating virtual try-ons too quickly. Please wait a few minutes and try again."
});
router.use(authenticateToken);

router.post(
  "/generate",
  generateRateLimit,
  validate(outfitRequestSchema),
  generateOutfit
);

router.get("/try-on/status", getTryOnStatus);

router.get("/saved", getSavedOutfits);
router.post("/saved", validate(saveOutfitSchema), saveOutfit);
router.delete(
  "/saved/:lookId",
  validateParams(savedLookParamsSchema),
  deleteSavedOutfit
);

router.post(
  "/try-on",
  tryOnRateLimit,
  tryOnImageUpload.single("modelImage"),
  validateTryOnRequest,
  createTryOn
);

export default router;
