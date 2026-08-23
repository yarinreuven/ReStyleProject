import express, { type NextFunction, type Request, type Response } from "express";

import {
  addMarketplaceFavorite,
  getMarketplaceFavorites,
  removeMarketplaceFavorite
} from "../controllers/marketplaceFavoriteController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { marketplaceFavoriteItemParamsSchema } from "../validation/marketplaceFavoriteValidation.ts";

const router = express.Router();

function validateItemIdParams(req: Request, res: Response, next: NextFunction) {
  const { error, value } = marketplaceFavoriteItemParamsSchema.validate(
    req.params,
    { abortEarly: false, stripUnknown: true }
  );

  if (error) {
    res.status(400).json({
      success: false,
      message: error.details[0]?.message,
      errors: error.details.map((detail) => detail.message)
    });
    return;
  }

  req.params = value;
  next();
}

router.use(authenticateToken);

router.get("/", getMarketplaceFavorites);
router.post("/:itemId", validateItemIdParams, addMarketplaceFavorite);
router.delete("/:itemId", validateItemIdParams, removeMarketplaceFavorite);

export default router;
