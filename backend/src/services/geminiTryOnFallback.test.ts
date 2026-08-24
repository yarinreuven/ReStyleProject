import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  createGeminiTryOnImage,
  GEMINI_TRY_ON_IMAGE_FALLBACK_MODEL
} from "./geminiTryOnService.ts";

test("falls back to the alternate image model after a primary 429 without network access", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "local-test-key";
  const image = await sharp({
    create: { width: 16, height: 24, channels: 3, background: "white" }
  }).png().toBuffer();
  let calls = 0;
  const fetchStub = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({
        error: { code: 429, status: "RESOURCE_EXHAUSTED" }
      }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ inlineData: { data: image.toString("base64"), mimeType: "image/png" } }]
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await createGeminiTryOnImage(
      image,
      "image/png",
      [{
        itemId: "dress",
        name: "Dress",
        detectedCategory: "Dress",
        data: image,
        contentType: "image/png"
      }],
      fetchStub as typeof fetch
    );
    assert.equal(calls, 2);
    assert.equal(result.model, GEMINI_TRY_ON_IMAGE_FALLBACK_MODEL);
    assert.equal(result.contentType, "image/png");
    assert.deepEqual(result.data, image);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
