const trustedYouTubeHosts = new Set([
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com"
]);

export function getTrustedTutorialUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = [...trustedYouTubeHosts].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
    if (
      url.protocol !== "https:" ||
      !trustedHost ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}
