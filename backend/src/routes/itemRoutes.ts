import { Router } from "express";
import multer from "multer";

import {
  addWornDate,
  createItem,
  deleteItem,
  getItems,
  removeWornDate,
  updateFavorite,
  updateItem
} from "../controllers/itemController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  createItemSchema,
  itemIdParamsSchema,
  requiredWearDateSchema,
  requireItemUpdate,
  updateFavoriteSchema,
  updateItemSchema,
  wearDateSchema
} from "../validation/itemValidation.ts";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) callback(null, true);
    else callback(new Error("Only image files are allowed"));
  }
});

router.use(authenticateToken);

router.post("/", upload.single("image"), validate(createItemSchema), createItem);
router.get("/", getItems);
router.put(
  "/:id/favorite",
  validateParams(itemIdParamsSchema),
  validate(updateFavoriteSchema),
  updateFavorite
);
router.put(
  "/:id/worn",
  validateParams(itemIdParamsSchema),
  validate(wearDateSchema),
  addWornDate
);
router.delete(
  "/:id/worn",
  validateParams(itemIdParamsSchema),
  validate(requiredWearDateSchema),
  removeWornDate
);
router.put(
  "/:id",
  upload.single("image"),
  validateParams(itemIdParamsSchema),
  validate(updateItemSchema),
  requireItemUpdate,
  updateItem
);
router.delete("/:id", validateParams(itemIdParamsSchema), deleteItem);

export default router;
