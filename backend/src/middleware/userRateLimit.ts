import type { NextFunction, Response } from "express";

import type { AuthRequest } from "./auth.ts";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  code: string;
  message: string;
}

export class UserSlidingWindowRateLimiter {
  private readonly requests = new Map<string, number[]>();
  private consumeCount = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(userId: string, now = Date.now()) {
    const cutoff = now - this.windowMs;
    this.consumeCount += 1;
    if (this.consumeCount % 1000 === 0) {
      for (const [key, timestamps] of this.requests) {
        if (!timestamps.some((timestamp) => timestamp > cutoff)) this.requests.delete(key);
      }
    }
    const active = (this.requests.get(userId) || []).filter((timestamp) => timestamp > cutoff);
    if (active.length >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((active[0] + this.windowMs - now) / 1000));
      this.requests.set(userId, active);
      return { allowed: false, retryAfterSeconds };
    }
    active.push(now);
    this.requests.set(userId, active);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(userId?: string) {
    if (userId) this.requests.delete(userId);
    else this.requests.clear();
  }
}

export function createUserRateLimit(options: RateLimitOptions) {
  const limiter = new UserSlidingWindowRateLimiter(options.maxRequests, options.windowMs);
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      next();
      return;
    }
    const result = limiter.consume(req.userId);
    if (result.allowed) {
      next();
      return;
    }
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: options.code,
      message: options.message
    });
  };
}
