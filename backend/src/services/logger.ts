import pino from "pino";

/** Structured application logger used by server, middleware, and integrations. */
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: ["password", "token", "accessToken", "refreshToken", "authorization", "req.headers.authorization"],
    censor: "[REDACTED]"
  }
});

export default logger;
