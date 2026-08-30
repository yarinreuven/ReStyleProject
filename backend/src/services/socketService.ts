import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import Conversation from "../models/Conversation.ts";
import { getAllowedOrigins } from "./frontendConfigService.ts";

export { getAllowedOrigins } from "./frontendConfigService.ts";

interface SocketTokenPayload {
  userId: string;
  email: string;
}

let io: Server | null = null;

export function initializeSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = process.env.JWT_SECRET;
      if (!token || !secret) return next(new Error("Authentication required"));
      const payload = jwt.verify(token, secret) as SocketTokenPayload;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    const conversations = await Conversation.find({ participants: userId }).select("_id");
    await socket.join(conversations.map((conversation) => `conversation:${conversation._id}`));

    socket.on("conversation:join", async (conversationId, acknowledge) => {
      const allowed = await Conversation.exists({ _id: conversationId, participants: userId });
      if (!allowed) {
        acknowledge?.({ success: false });
        return;
      }
      await socket.join(`conversation:${conversationId}`);
      acknowledge?.({ success: true });
    });
  });

  return io;
}

export async function joinParticipantsToConversation(conversationId: string, participantIds: string[]) {
  if (!io) return;
  const participantSet = new Set(participantIds.map(String));
  const sockets = await io.fetchSockets();
  await Promise.all(sockets
    .filter((socket) => participantSet.has(String(socket.data.userId)))
    .map((socket) => socket.join(`conversation:${conversationId}`)));
}

export function emitNewMessage(conversationId: string, message: Record<string, unknown>) {
  io?.to(`conversation:${conversationId}`).emit("message:new", {
    conversationId,
    message
  });
}

export function emitConversationRead(conversationId: string, userId: string) {
  io?.to(`conversation:${conversationId}`).emit("conversation:read", {
    conversationId,
    userId
  });
}

export function emitMessageDeleted(
  conversationId: string,
  messageId: string
) {
  io?.to(`conversation:${conversationId}`).emit("message:deleted", {
    conversationId,
    messageId
  });
}
