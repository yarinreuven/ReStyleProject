import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationParamsSchema,
  messageParamsSchema,
  sendMessageSchema,
  startConversationSchema
} from "./messageValidation.ts";

const firstId = "507f1f77bcf86cd799439011";
const secondId = "507f1f77bcf86cd799439012";

test("starts a conversation with exactly one valid target", () => {
  assert.equal(startConversationSchema.validate({ itemId: firstId }).error, undefined);
  assert.equal(startConversationSchema.validate({ sellerId: firstId }).error, undefined);
  assert.ok(startConversationSchema.validate({}).error);
  assert.ok(startConversationSchema.validate({ itemId: firstId, sellerId: secondId }).error);
});

test("trims valid messages and rejects empty or oversized messages", () => {
  const { error, value } = sendMessageSchema.validate({ text: "  Hello  " });
  assert.equal(error, undefined);
  assert.equal(value.text, "Hello");
  assert.ok(sendMessageSchema.validate({ text: "   " }).error);
  assert.ok(sendMessageSchema.validate({ text: "x".repeat(1001) }).error);
});

test("validates conversation and message route parameters", () => {
  assert.equal(conversationParamsSchema.validate({ conversationId: firstId }).error, undefined);
  assert.equal(messageParamsSchema.validate({
    conversationId: firstId,
    messageId: secondId
  }).error, undefined);
  assert.ok(messageParamsSchema.validate({ conversationId: "bad", messageId: secondId }).error);
});
