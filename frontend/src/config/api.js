const configuredApiUrl = import.meta.env?.VITE_API_URL?.trim();

export const API_BASE_URL = (configuredApiUrl || "/api").replace(/\/+$/, "");

export const SOCKET_BASE_URL = API_BASE_URL.startsWith("http")
  ? new URL(API_BASE_URL).origin
  : undefined;
