import type { NextFunction, Request, Response } from "express";
import Joi from "joi";

const categories = ["Tops", "Bottoms", "Dresses", "Jackets", "Shoes", "Bags", "Accessories"];

export const marketplaceItemSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  listingType: Joi.string().valid("sale", "rent").required(),
  price: Joi.alternatives().conditional("listingType", {
    is: "sale",
    then: Joi.number().positive().required().messages({
      "any.required": "Price is required for an item offered for sale",
      "number.base": "Price is required for an item offered for sale"
    }),
    otherwise: Joi.valid(null)
  }),
  rentalPricePerDay: Joi.alternatives().conditional("listingType", {
    is: "rent",
    then: Joi.number().positive().required().messages({
      "any.required": "Rental price per day is required for an item offered for rent",
      "number.base": "Rental price per day is required for an item offered for rent"
    }),
    otherwise: Joi.valid(null)
  }),
  size: Joi.string().trim().min(1).max(30).required(),
  condition: Joi.string().valid("New", "Like New", "Excellent", "Good", "Fair").required(),
  category: Joi.string().valid(...categories).required(),
  brand: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().trim().min(10).max(1000).required(),
  availabilityStatus: Joi.string()
    .valid("active", "reserved", "sold", "rented", "hidden")
    .default("active")
});

export const createMarketplaceItemSchema = marketplaceItemSchema;

export const marketplaceAvailabilitySchema = Joi.object({
  availabilityStatus: Joi.string().valid("active", "hidden").required()
});

export const marketplaceItemIdSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

export const marketplaceSellerIdSchema = Joi.object({
  userId: Joi.string().hex().length(24).required()
});

export function normalizeMarketplaceBody(req: Request, _res: Response, next: NextFunction) {
  req.body = {
    ...req.body,
    price: req.body.price === "" || req.body.price === undefined ? null : req.body.price,
    rentalPricePerDay: req.body.rentalPricePerDay === "" || req.body.rentalPricePerDay === undefined
      ? null
      : req.body.rentalPricePerDay
  };
  next();
}
