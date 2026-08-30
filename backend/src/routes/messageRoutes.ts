import { Router } from "express";

import {
  deleteMessage,
  getConversation,
  getConversations,
  hideConversation,
  markConversationRead,
  sendMessage,
  startConversation
} from "../controllers/messageController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  conversationParamsSchema,
  messageParamsSchema,
  sendMessageSchema,
  startConversationSchema
} from "../validation/messageValidation.ts";

const router = Router();

router.use(authenticateToken);
router.post("/conversations", validate(startConversationSchema), startConversation);
router.get("/conversations", getConversations);
router.get(
  "/conversations/:conversationId",
  validateParams(conversationParamsSchema),
  getConversation
);
router.post(
  "/conversations/:conversationId/messages",
  validateParams(conversationParamsSchema),
  validate(sendMessageSchema),
  sendMessage
);
router.post(
  "/conversations/:conversationId/read",
  validateParams(conversationParamsSchema),
  markConversationRead
);
router.delete(
  "/conversations/:conversationId",
  validateParams(conversationParamsSchema),
  hideConversation
);
router.delete(
  "/conversations/:conversationId/messages/:messageId",
  validateParams(messageParamsSchema),
  deleteMessage
);

export default router;
