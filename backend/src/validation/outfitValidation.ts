import Joi from "joi";

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
