import express from "express";
import Joi from "joi";
import mongoose from "mongoose";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import Conversation from "../models/Conversation.ts";
import Item from "../models/Item.ts";
import {
  emitConversationRead,
  emitNewMessage,
  joinParticipantsToConversation
} from "../services/socketService.ts";

const router = express.Router();
const startConversationSchema = Joi.object({
  itemId: Joi.string().required()
});
const sendMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required()
});

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
  const unreadCount = (object.messages || []).filter((message: any) =>
    String(message.sender?._id || message.sender) !== String(currentUserId) &&
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
    messages: (object.messages || []).map((message: any) => ({
      id: message._id,
      senderId: message.sender?._id || message.sender,
      senderName: message.sender?.firstName
        ? `${message.sender.firstName} ${message.sender.lastName}`.trim()
        : "ReStyle member",
      text: message.text,
      sentAt: message.sentAt
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
    if (error || !mongoose.isValidObjectId(value?.itemId)) {
      res.status(400).json({ success: false, message: "A valid item is required" });
      return;
    }

    const item = await Item.findOne({
      _id: value.itemId,
      listingType: { $in: ["sale", "rent"] },
      availabilityStatus: "active"
    }).select("user");

    if (!item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }
    if (String(item.user) === String(req.userId)) {
      res.status(400).json({ success: false, message: "You cannot contact yourself about your own listing" });
      return;
    }

    let conversation = await Conversation.findOne({
      item: item._id,
      participants: { $all: [req.userId, item.user], $size: 2 }
    });
    let created = false;
    if (!conversation) {
      conversation = await Conversation.create({
        item: item._id,
        participants: [req.userId, item.user],
        readState: [
          { user: req.userId, lastReadAt: new Date() },
          { user: item.user, lastReadAt: new Date() }
        ]
      });
      created = true;
    }

    await joinParticipantsToConversation(String(conversation._id), [
      String(req.userId),
      String(item.user)
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
    const conversations = await Conversation.find({ participants: req.userId })
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
      participants: req.userId
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

    conversation.messages.push({
      sender: new mongoose.Types.ObjectId(req.userId),
      text: value.text,
      sentAt: new Date()
    } as any);
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

export default router;
