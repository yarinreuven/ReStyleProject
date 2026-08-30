import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from "express";
import multer from "multer";
import {
  InvalidWardrobeImageError,
  WardrobeImageCheckUnavailableError
} from "../services/wardrobeImageService.ts";
import logger from "../services/logger.ts";

/** Returns the upload limit message for the Multer field that failed. */
export function uploadSizeMessage(field?: string) {
  return field === "image"
    ? "Image must be smaller than 10MB"
    : "Image must be smaller than 5MB";
}

/** Converts application and middleware failures into consistent safe JSON responses. */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestError = error as Error & { status?: number; type?: string };
  if (requestError.status === 413) {
    res.status(413).json({ success: false, message: "Request body is too large" });
    return;
  }
  if (requestError.status === 400 && requestError.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Request body is invalid" });
    return;
  }
  if (error instanceof WardrobeImageCheckUnavailableError) {
    res.status(503).json({
      success: false,
      code: "IMAGE_VERIFICATION_UNAVAILABLE",
      message: error.message
    });
    return;
  }
  if (error instanceof InvalidWardrobeImageError) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof multer.MulterError) {
    const isTooLarge = error.code === "LIMIT_FILE_SIZE";
    res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge ? uploadSizeMessage(error.field) : error.message
    });
    return;
  }

  if ([
    "Please choose a JPG, PNG or WEBP image",
    "Marketplace images must be JPG, PNG or WEBP",
    "The virtual model must be a JPG, PNG or WEBP image"
  ].includes(error.message)) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  logger.error({ err: error, method: req.method, path: req.path }, "Unhandled request error");
  res.status(500).json({ success: false, message: "Server error. Please try again." });
};
