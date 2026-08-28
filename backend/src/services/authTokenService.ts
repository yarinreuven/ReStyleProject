import crypto from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";

import RefreshSession from "../models/RefreshSession.ts";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE_NAME = "restyle_refresh";

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" as const : "lax" as const,
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_MS
  };
}

export function createAccessToken(userId: string, email: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");
  return jwt.sign({ userId, email }, secret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function readRefreshCookie(req: Request) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === REFRESH_COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function issueAuthSession(user: { _id: Types.ObjectId | string; email: string }, res: Response) {
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await RefreshSession.create({
    user: user._id,
    tokenHash: tokenHash(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
  return createAccessToken(String(user._id), user.email);
}

export async function consumeRefreshSession(req: Request) {
  const token = readRefreshCookie(req);
  if (!token) return null;
  return RefreshSession.findOneAndDelete({
    tokenHash: tokenHash(token),
    expiresAt: { $gt: new Date() }
  });
}

export async function revokeRefreshSession(req: Request) {
  const token = readRefreshCookie(req);
  if (token) await RefreshSession.deleteOne({ tokenHash: tokenHash(token) });
}

export async function revokeAllRefreshSessions(userId: string) {
  await RefreshSession.deleteMany({ user: userId });
}

export function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}
