import Joi from "joi";

export const paypalPlanSchema = Joi.object({
  plan: Joi.string().valid("mini", "style").required(),
  product: Joi.string().valid("tryon", "restyle").required()
});

export const paypalOrderParamsSchema = Joi.object({
  orderId: Joi.string().pattern(/^[A-Z0-9]+$/).max(30).required()
});
