interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export const GEMINI_STYLIST_MODEL = "gemini-3.1-flash-lite";
const GEMINI_STYLIST_MAX_REQUEST_BYTES = 18 * 1024 * 1024;

export async function requestGeminiStylist(
  apiKey: string,
  requestBody: object
): Promise<{ response: Response; data: GeminiResponse; model: string }> {
  const serializedBody = JSON.stringify(requestBody);
  if (Buffer.byteLength(serializedBody, "utf8") > GEMINI_STYLIST_MAX_REQUEST_BYTES) {
    throw new Error("GEMINI_STYLIST_PAYLOAD_TOO_LARGE");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STYLIST_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: serializedBody,
      signal: AbortSignal.timeout(90 * 1000)
    }
  );
  const data = await response.json() as GeminiResponse;

  return { response, data, model: GEMINI_STYLIST_MODEL };
}
