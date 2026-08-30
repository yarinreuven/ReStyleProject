import { Router } from "express";
import multer from "multer";

import {
  createMarketplaceItem,
  getMarketplaceItem,
  getMarketplaceItems,
  getMarketplaceSeller,
  getMyMarketplaceItems,
  removeMarketplaceItem,
  updateMarketplaceAvailability,
  updateMarketplaceItem
} from "../controllers/marketplaceController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  createMarketplaceItemSchema,
  marketplaceAvailabilitySchema,
  marketplaceItemIdSchema,
  marketplaceItemSchema,
  marketplaceSellerIdSchema,
  normalizeMarketplaceBody
} from "../validation/marketplaceValidation.ts";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) callback(null, true);
    else callback(new Error("Marketplace images must be JPG, PNG or WEBP"));
  }
});

router.use(authenticateToken);

router.get("/", getMarketplaceItems);
router.get("/mine", getMyMarketplaceItems);
router.get(
  "/sellers/:userId",
  validateParams(marketplaceSellerIdSchema),
  getMarketplaceSeller
);
router.get("/:id", validateParams(marketplaceItemIdSchema), getMarketplaceItem);
router.post(
  "/",
  upload.array("images", 4),
  normalizeMarketplaceBody,
  validate(createMarketplaceItemSchema),
  createMarketplaceItem
);
router.put(
  "/:id",
  upload.array("images", 4),
  validateParams(marketplaceItemIdSchema),
  normalizeMarketplaceBody,
  validate(marketplaceItemSchema),
  updateMarketplaceItem
);
router.patch(
  "/:id/availability",
  validateParams(marketplaceItemIdSchema),
  validate(marketplaceAvailabilitySchema),
  updateMarketplaceAvailability
);
router.delete("/:id", validateParams(marketplaceItemIdSchema), removeMarketplaceItem);

export default router;
