import type { NextFunction, Response } from "express";
import mongoose from "mongoose";

import type { AuthRequest } from "./auth.ts";
import { tryOnRequestValidationError } from "../services/tryOnValidationService.ts";

export function validateTryOnRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
    res.status(401).json({ success: false, message: "Authentication is required" });
    return;
  }

  const message = tryOnRequestValidationError(req.body);
  if (message) {
    res.status(400).json({ success: false, message });
    return;
  }

  next();
}
