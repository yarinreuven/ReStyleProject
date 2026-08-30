import Joi from "joi";
import type { NextFunction, Request, Response } from "express";

const categories = ["Tops", "Bottoms", "Dresses", "Jackets", "Shoes", "Bags", "Accessories"];
const seasons = ["All Season", "Summer", "Winter", "Spring", "Fall"];
const styles = ["Casual", "Classic", "Elegant", "Sporty", "Streetwear"];

const itemFields = {
  name: Joi.string().trim().min(1).max(120),
  category: Joi.string().valid(...categories),
  color: Joi.string().trim().min(1).max(60),
  season: Joi.string().valid(...seasons),
  style: Joi.string().valid(...styles)
};

export const createItemSchema = Joi.object({
  name: itemFields.name.required(),
  category: itemFields.category.required(),
  color: itemFields.color.required(),
  season: itemFields.season.required(),
  style: itemFields.style.required(),
  favorite: Joi.boolean().default(false)
});

export const updateItemSchema = Joi.object(itemFields);

export const updateFavoriteSchema = Joi.object({
  favorite: Joi.boolean().required()
});

export const wearDateSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const requiredWearDateSchema = wearDateSchema.fork("date", (schema) => schema.required());

export const itemIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

export function requireItemUpdate(req: Request, res: Response, next: NextFunction) {
  if (!req.file && Object.keys(req.body).length === 0) {
    res.status(400).json({
      success: false,
      message: "Provide at least one item field or a new image"
    });
    return;
  }
  next();
}
