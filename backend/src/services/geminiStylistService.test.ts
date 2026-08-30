import assert from "node:assert/strict";
import test from "node:test";

import { requestGeminiStylist } from "./geminiStylistService.ts";

test("rejects an oversized stylist payload before making a network request", async () => {
  await assert.rejects(
    requestGeminiStylist("test-key", { content: "x".repeat(18 * 1024 * 1024) }),
    /GEMINI_STYLIST_PAYLOAD_TOO_LARGE/
  );
});
