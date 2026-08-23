import express from "express";
import Joi from "joi";
import mongoose from "mongoose";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import Conversation from "../models/Conversation.ts";
import Item from "../models/Item.ts";
import User from "../models/User.ts";
import {
  emitConversationRead,
  emitMessageDeleted,
  emitNewMessage,
  joinParticipantsToConversation
} from "../services/socketService.ts";

const router = express.Router();
const startConversationSchema = Joi.object({
  itemId: Joi.string(),
  sellerId: Joi.string()
}).xor("itemId", "sellerId");
const sendMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required()
});

async function usersAreBlocked(firstUserId: string, secondUserId: string) {
  return Boolean(await User.exists({
    $or: [
      { _id: firstUserId, blockedUsers: secondUserId },
      { _id: secondUserId, blockedUsers: firstUserId }
    ]
  }));
}

function imageToDataUrl(image?: { data?: Buffer; contentType?: string } | null) {
  if (!image?.data || !image.contentType) return "";
  return `data:${image.contentType};base64,${image.data.toString("base64")}`;
}

function formatConversation(conversation: any, currentUserId: string) {
  const object = conversation.toObject ? conversation.toObject() : conversation;
  const otherUser = object.participants.find(
    (participant: any) => String(participant._id) !== String(currentUserId)
  );
  const itemImage = object.item?.marketplaceImages?.[0] || object.item?.image;
  const lastReadAt = object.readState?.find(
    (state: any) => String(state.user) === String(currentUserId)
  )?.lastReadAt;
  const clearedAt = object.clearedState?.find(
    (state: any) => String(state.user) === String(currentUserId)
  )?.clearedAt;
  const unreadCount = (object.messages || []).filter((message: any) =>
    String(message.sender?._id || message.sender) !== String(currentUserId) &&
    (!clearedAt || new Date(message.sentAt) > new Date(clearedAt)) &&
    !(message.hiddenFor || []).some(
      (hiddenUserId: any) => String(hiddenUserId) === String(currentUserId)
    ) &&
    (!lastReadAt || new Date(message.sentAt) > new Date(lastReadAt))
  ).length;

  return {
    id: object._id,
    otherUser: otherUser ? {
      id: otherUser._id,
      name: `${otherUser.firstName} ${otherUser.lastName}`.trim(),
      avatar: imageToDataUrl(otherUser.profileImage)
    } : null,
    item: object.item ? {
      id: object.item._id,
      name: object.item.name,
      image: imageToDataUrl(itemImage),
      listingType: object.item.listingType,
      availabilityStatus: object.item.availabilityStatus
    } : null,
    messages: (object.messages || [])
      .filter((message: any) =>
        !clearedAt || new Date(message.sentAt) > new Date(clearedAt)
      )
      .filter((message: any) => !(message.hiddenFor || []).some(
        (hiddenUserId: any) => String(hiddenUserId) === String(currentUserId)
      ))
      .map((message: any) => ({
      id: message._id,
      senderId: message.sender?._id || message.sender,
      senderName: message.sender?.firstName
        ? `${message.sender.firstName} ${message.sender.lastName}`.trim()
        : "ReStyle member",
      text: message.text,
      sentAt: message.sentAt,
      deletedAt: message.deletedAt
      })),
    lastMessageAt: object.lastMessageAt,
    unreadCount,
    createdAt: object.createdAt
  };
}

const conversationPopulate = [
  { path: "participants", select: "firstName lastName profileImage" },
  { path: "item", select: "name image marketplaceImages listingType availabilityStatus user" },
  { path: "messages.sender", select: "firstName lastName" }
];

router.use(authenticateToken);

router.post("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = startConversationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    const targetId = value?.itemId || value?.sellerId;
    if (error || !mongoose.isValidObjectId(targetId)) {
      res.status(400).json({ success: false, message: "A valid item or seller is required" });
      return;
    }

    const item = value.itemId ? await Item.findOne({
        _id: value.itemId,
        listingType: { $in: ["sale", "rent"] },
        availabilityStatus: "active"
      }).select("user") : null;
    const sellerId = item?.user || value.sellerId;

    if (value.itemId && !item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }
    if (!value.itemId && !await User.exists({ _id: sellerId })) {
      res.status(404).json({ success: false, message: "Seller not found" });
      return;
    }
    if (String(sellerId) === String(req.userId)) {
      res.status(400).json({ success: false, message: "You cannot contact yourself" });
      return;
    }
    if (await usersAreBlocked(String(req.userId), String(sellerId))) {
      res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "Messages are unavailable because of a block between these accounts"
      });
      return;
    }

    const existingConversations = await Conversation.find({
      participants: { $all: [req.userId, sellerId], $size: 2 }
    }).sort({ createdAt: 1 });
    let conversation = existingConversations[0] || null;
    let created = false;
    if (!conversation) {
      conversation = await Conversation.create({
        item: null,
        participants: [req.userId, sellerId],
        readState: [
          { user: req.userId, lastReadAt: new Date() },
          { user: sellerId, lastReadAt: new Date() }
        ]
      });
      created = true;
    } else {
      const duplicateIds = existingConversations.slice(1).map(({ _id }) => _id);
      if (duplicateIds.length > 0) {
        const messages = existingConversations
          .flatMap((existing) => existing.messages)
          .sort((first, second) => first.sentAt.getTime() - second.sentAt.getTime());
        conversation.item = null;
        conversation.messages.splice(0, conversation.messages.length, ...messages);
        conversation.lastMessageAt = messages[messages.length - 1]?.sentAt || conversation.lastMessageAt;
        await conversation.save();
        await Conversation.deleteMany({ _id: { $in: duplicateIds } });
      } else if (conversation.item) {
        conversation.item = null;
        await conversation.save();
      }
    }

    conversation.hiddenFor = conversation.hiddenFor.filter(
      (hiddenUserId) => String(hiddenUserId) !== String(req.userId)
    );
    await conversation.save();

    await joinParticipantsToConversation(String(conversation._id), [
      String(req.userId),
      String(sellerId)
    ]);

    await conversation.populate(conversationPopulate);
    res.status(created ? 201 : 200).json({
      success: true,
      conversation: formatConversation(conversation, req.userId as string)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
      hiddenFor: { $ne: req.userId }
    })
      .populate(conversationPopulate)
      .sort({ lastMessageAt: -1 });
    res.json({
      success: true,
      conversations: conversations.map((conversation) =>
        formatConversation(conversation, req.userId as string)
      )
    });
  } catch (error) {
    next(error);
  }
});

router.get("/conversations/:conversationId", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId,
      hiddenFor: { $ne: req.userId }
    }).populate(conversationPopulate);

    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    res.json({
      success: true,
      conversation: formatConversation(conversation, req.userId as string)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/conversations/:conversationId/messages", async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      res.status(400).json({ success: false, message: error.details[0]?.message });
      return;
    }
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId
    });
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    const otherUserId = conversation.participants.find(
      (participantId) => String(participantId) !== String(req.userId)
    );
    if (!otherUserId || await usersAreBlocked(String(req.userId), String(otherUserId))) {
      res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "Messages are unavailable because of a block between these accounts"
      });
      return;
    }

    conversation.messages.push({
      sender: new mongoose.Types.ObjectId(req.userId),
      text: value.text,
      sentAt: new Date()
    } as any);
    conversation.hiddenFor.splice(0, conversation.hiddenFor.length);
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await conversation.populate(conversationPopulate);

    const savedMessage = conversation.messages[conversation.messages.length - 1] as any;
    emitNewMessage(String(conversation._id), {
      id: savedMessage._id,
      senderId: savedMessage.sender?._id || savedMessage.sender,
      senderName: savedMessage.sender?.firstName
        ? `${savedMessage.sender.firstName} ${savedMessage.sender.lastName}`.trim()
        : "ReStyle member",
      text: savedMessage.text,
      sentAt: savedMessage.sentAt
    });

    res.status(201).json({
      success: true,
      conversation: formatConversation(conversation, req.userId as string)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/conversations/:conversationId/read", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId
    });
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    const state = conversation.readState.find(
      (entry: any) => String(entry.user) === String(req.userId)
    );
    if (state) state.lastReadAt = new Date();
    else conversation.readState.push({ user: new mongoose.Types.ObjectId(req.userId), lastReadAt: new Date() } as any);
    await conversation.save();
    emitConversationRead(String(conversation._id), String(req.userId));
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
});

router.delete("/conversations/:conversationId", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId
    });
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    if (!conversation.hiddenFor.some(
      (hiddenUserId) => String(hiddenUserId) === String(req.userId)
    )) {
      conversation.hiddenFor.push(new mongoose.Types.ObjectId(req.userId));
    }
    const clearedState = conversation.clearedState.find(
      (state: any) => String(state.user) === String(req.userId)
    );
    if (clearedState) clearedState.clearedAt = new Date();
    else conversation.clearedState.push({
      user: new mongoose.Types.ObjectId(req.userId),
      clearedAt: new Date()
    } as any);
    await conversation.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  async (req: AuthRequest, res, next) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.conversationId) ||
        !mongoose.isValidObjectId(req.params.messageId)
      ) {
        res.status(404).json({ success: false, message: "Message not found" });
        return;
      }

      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participants: req.userId
      });
      if (!conversation) {
        res.status(404).json({ success: false, message: "Message not found" });
        return;
      }

      const message = conversation.messages.id(String(req.params.messageId)) as any;
      if (!message || String(message.sender) !== String(req.userId)) {
        res.status(404).json({ success: false, message: "Message not found" });
        return;
      }
      if (message.deletedAt) {
        res.status(400).json({ success: false, message: "This message was already deleted" });
        return;
      }

      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - new Date(message.sentAt).getTime() > tenMinutes) {
        res.status(400).json({
          success: false,
          message: "Messages can only be deleted within 10 minutes of sending"
        });
        return;
      }

      const deletedMessageId = String(message._id);
      message.deleteOne();
      await conversation.save();
      emitMessageDeleted(
        String(conversation._id),
        deletedMessageId
      );

      res.json({
        success: true,
        message: {
          id: deletedMessageId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
