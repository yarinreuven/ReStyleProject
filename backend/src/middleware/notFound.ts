import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    method: req.method,
    path: req.path
  });
};
