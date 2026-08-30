const AUTH_LIFECYCLE_ENDPOINTS = new Set([
  "refresh",
  "login",
  "register",
  "google",
  "logout",
  "forgot-password",
  "reset-password"
]);

export function isAuthLifecycleRequest(requestUrl, authUrl) {
  if (!requestUrl || !authUrl) return false;
  const normalizedAuthUrl = authUrl.replace(/\/+$/, "");
  const normalizedRequestUrl = requestUrl.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const prefix = `${normalizedAuthUrl}/`;
  if (!normalizedRequestUrl.startsWith(prefix)) return false;
  return AUTH_LIFECYCLE_ENDPOINTS.has(normalizedRequestUrl.slice(prefix.length));
}
