import Joi from "joi";

export const outfitRequestSchema = Joi.object({
  event: Joi.string().trim().min(2).max(250).required(),
  style: Joi.string()
    .valid("Casual", "Classic", "Elegant", "Sporty", "Streetwear")
    .required(),
  weather: Joi.string()
    .valid("Warm", "Mild", "Cold", "Rainy")
    .required(),
  preferFavorites: Joi.boolean().required(),
  avatarSource: Joi.string().valid("preset", "personal").required()
});

export const saveOutfitSchema = Joi.object({
  selectionId: Joi.string().hex().length(24).required().messages({
    "any.required": "Choose a valid generated look",
    "string.empty": "Choose a valid generated look",
    "string.hex": "Choose a valid generated look",
    "string.length": "Choose a valid generated look"
  })
});

export const savedLookParamsSchema = Joi.object({
  lookId: Joi.string().hex().length(24).required().messages({
    "any.required": "Choose a valid saved look",
    "string.empty": "Choose a valid saved look",
    "string.hex": "Choose a valid saved look",
    "string.length": "Choose a valid saved look"
  })
});
