import type { NextFunction, Response } from "express";
import mongoose from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import { getTryOnQuotaStatus } from "../services/tryOnQuotaService.ts";

export async function getTryOnStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
      res.status(401).json({ success: false, message: "Authentication is required" });
      return;
    }

    const quota = await getTryOnQuotaStatus(req.userId);
    if (!quota) {
      res.status(404).json({ success: false, message: "User account not found" });
      return;
    }

    res.json(quota);
  } catch (error) {
    next(error);
  }
}
