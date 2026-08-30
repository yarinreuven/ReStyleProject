import type { NextFunction, Response } from "express";
import mongoose from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import Conversation from "../models/Conversation.ts";
import Item from "../models/Item.ts";
import User from "../models/User.ts";
import {
  emitConversationRead,
  emitMessageDeleted,
  emitNewMessage,
  joinParticipantsToConversation
} from "../services/socketService.ts";

const conversationPopulate = [
  { path: "participants", select: "firstName lastName profileImage" },
  { path: "item", select: "name image marketplaceImages listingType availabilityStatus user" },
  { path: "messages.sender", select: "firstName lastName" }
];

async function usersAreBlocked(firstUserId: string, secondUserId: string) {
  return Boolean(await User.exists({
    $or: [
      { _id: firstUserId, blockedUsers: secondUserId },
      { _id: secondUserId, blockedUsers: firstUserId }
    ]
  }));
}

function imageToDataUrl(image?: { data?: Buffer; contentType?: string } | null) {
  return image?.data && image.contentType
    ? `data:${image.contentType};base64,${image.data.toString("base64")}`
    : "";
}

function formatConversation(conversation: any, currentUserId: string) {
  const object = conversation.toObject ? conversation.toObject() : conversation;
  const otherUser = object.participants.find(
    (participant: any) => String(participant._id) !== currentUserId
  );
  const itemImage = object.item?.marketplaceImages?.[0] || object.item?.image;
  const lastReadAt = object.readState?.find(
    (state: any) => String(state.user) === currentUserId
  )?.lastReadAt;
  const clearedAt = object.clearedState?.find(
    (state: any) => String(state.user) === currentUserId
  )?.clearedAt;
  const visibleMessages = (object.messages || [])
    .filter((message: any) => !clearedAt || new Date(message.sentAt) > new Date(clearedAt))
    .filter((message: any) => !(message.hiddenFor || []).some(
      (hiddenUserId: any) => String(hiddenUserId) === currentUserId
    ));
  const unreadCount = visibleMessages.filter((message: any) =>
    String(message.sender?._id || message.sender) !== currentUserId &&
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
    messages: visibleMessages.map((message: any) => ({
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

export async function startConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { itemId, sellerId: requestedSellerId } = req.body;
    const item = itemId ? await Item.findOne({
      _id: itemId,
      listingType: { $in: ["sale", "rent"] },
      availabilityStatus: "active"
    }).select("user") : null;
    const sellerId = item?.user || requestedSellerId;

    if (itemId && !item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }
    if (!itemId && !await User.exists({ _id: sellerId })) {
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
      if (duplicateIds.length) {
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
      conversation: formatConversation(conversation, String(req.userId))
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
      hiddenFor: { $ne: req.userId }
    }).populate(conversationPopulate).sort({ lastMessageAt: -1 });
    res.json({
      success: true,
      conversations: conversations.map((conversation) =>
        formatConversation(conversation, String(req.userId))
      )
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
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
      conversation: formatConversation(conversation, String(req.userId))
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
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
      text: req.body.text,
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
      conversation: formatConversation(conversation, String(req.userId))
    });
  } catch (error) {
    next(error);
  }
}

export async function markConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
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
    else conversation.readState.push({
      user: new mongoose.Types.ObjectId(req.userId),
      lastReadAt: new Date()
    } as any);
    await conversation.save();
    emitConversationRead(String(conversation._id), String(req.userId));
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
}

export async function hideConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId
    });
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    if (!conversation.hiddenFor.some((id) => String(id) === String(req.userId))) {
      conversation.hiddenFor.push(new mongoose.Types.ObjectId(req.userId));
    }
    const state = conversation.clearedState.find(
      (entry: any) => String(entry.user) === String(req.userId)
    );
    if (state) state.clearedAt = new Date();
    else conversation.clearedState.push({
      user: new mongoose.Types.ObjectId(req.userId),
      clearedAt: new Date()
    } as any);
    await conversation.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.userId
    });
    const message = conversation?.messages.id(String(req.params.messageId)) as any;
    if (!conversation || !message || String(message.sender) !== String(req.userId)) {
      res.status(404).json({ success: false, message: "Message not found" });
      return;
    }
    if (message.deletedAt) {
      res.status(400).json({ success: false, message: "This message was already deleted" });
      return;
    }
    if (Date.now() - new Date(message.sentAt).getTime() > 10 * 60 * 1000) {
      res.status(400).json({
        success: false,
        message: "Messages can only be deleted within 10 minutes of sending"
      });
      return;
    }

    const messageId = String(message._id);
    message.deleteOne();
    await conversation.save();
    emitMessageDeleted(String(conversation._id), messageId);
    res.json({ success: true, message: { id: messageId } });
  } catch (error) {
    next(error);
  }
}
