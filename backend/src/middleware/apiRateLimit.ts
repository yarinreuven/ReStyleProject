import { rateLimit } from "express-rate-limit";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: { method: string }) => req.method === "OPTIONS"
};

export const apiRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: {
    success: false,
    code: "API_RATE_LIMITED",
    message: "Too many requests. Please try again later."
  }
});

export const authRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: "AUTH_RATE_LIMITED",
    message: "Too many authentication attempts. Please try again later."
  }
});
