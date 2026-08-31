const DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5175"
];

export function resolveFrontendUrl(
  configuredUrl: string | undefined,
  nodeEnv: string | undefined
) {
  const frontendUrl = configuredUrl?.trim();
  if (frontendUrl) return frontendUrl.replace(/\/$/, "");
  if (nodeEnv === "production") {
    throw new Error("FRONTEND_URL is required in production");
  }
  return DEVELOPMENT_ORIGINS[0];
}

export function resolveAllowedOrigins(
  configuredUrl: string | undefined,
  nodeEnv: string | undefined
) {
  const frontendUrl = configuredUrl?.trim().replace(/\/$/, "");
  if (nodeEnv === "production") {
    return [resolveFrontendUrl(frontendUrl, nodeEnv)];
  }
  return [...new Set([
    ...DEVELOPMENT_ORIGINS,
    ...(frontendUrl ? [frontendUrl] : [])
  ])];
}

export function getFrontendUrl() {
  const renderUrl = process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : undefined;
  return resolveFrontendUrl(process.env.FRONTEND_URL || renderUrl, process.env.NODE_ENV);
}

export function getAllowedOrigins() {
  const renderUrl = process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : undefined;
  return resolveAllowedOrigins(process.env.FRONTEND_URL || renderUrl, process.env.NODE_ENV);
}
