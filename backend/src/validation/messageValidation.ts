import Joi from "joi";

const objectId = Joi.string().hex().length(24);

export const startConversationSchema = Joi.object({
  itemId: objectId,
  sellerId: objectId
}).xor("itemId", "sellerId").messages({
  "object.xor": "A valid item or seller is required",
  "object.missing": "A valid item or seller is required"
});

export const sendMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required()
});

export const conversationParamsSchema = Joi.object({
  conversationId: objectId.required()
});

export const messageParamsSchema = Joi.object({
  conversationId: objectId.required(),
  messageId: objectId.required()
});
