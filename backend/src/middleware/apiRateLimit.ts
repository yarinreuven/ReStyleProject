import { rateLimit } from "express-rate-limit";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: { method: string }) => req.method === "OPTIONS"
};

const separatelyRateLimitedAuthRoutes = new Set([
  "/auth/register",
  "/auth/login",
  "/auth/google",
  "/auth/forgot-password",
  "/auth/reset-password"
]);

export const apiRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  skip: (req) =>
    req.method === "OPTIONS" || separatelyRateLimitedAuthRoutes.has(req.path),
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
