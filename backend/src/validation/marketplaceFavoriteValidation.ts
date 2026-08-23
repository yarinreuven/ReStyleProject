import Joi from "joi";

export const marketplaceFavoriteItemParamsSchema = Joi.object({
  itemId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      "string.hex": "Item ID must be a valid MongoDB ObjectId",
      "string.length": "Item ID must be a valid MongoDB ObjectId",
      "string.empty": "Item ID is required",
      "any.required": "Item ID is required"
    })
});
