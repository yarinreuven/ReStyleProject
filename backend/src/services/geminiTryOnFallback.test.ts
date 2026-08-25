import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  buildTryOnGenerationParts,
  createGeminiTryOnImage,
  inferRequiredGarmentType,
  GEMINI_TRY_ON_IMAGE_FALLBACK_MODEL
} from "./geminiTryOnService.ts";

test("treats a Hebrew skirt name as a hard skirt requirement", () => {
  assert.equal(
    inferRequiredGarmentType("חצאית", "Bottom", "dark denim bottom"),
    "skirt"
  );
});

test("locks facial identity and exact garment subtype in the generation prompt", () => {
  const parts = buildTryOnGenerationParts(
    Buffer.from("avatar"),
    "image/png",
    [{
      itemId: "skirt",
      name: "חצאית",
      detectedCategory: "Bottom",
      visualDescription: "black pleated midi skirt",
      data: Buffer.from("item"),
      contentType: "image/png"
    }]
  );
  const prompt = parts
    .filter((part): part is { text: string } => "text" in part)
    .map((part) => part.text)
    .join("\n");

  assert.match(prompt, /IDENTITY LOCK/);
  assert.match(prompt, /Do not beautify, retouch/);
  assert.match(prompt, /BACKGROUND REPLACEMENT/);
  assert.match(prompt, /original background is not reference content/);
  assert.match(prompt, /a skirt must remain a skirt/);
  assert.match(prompt, /REQUIRED_GARMENT_TYPE=skirt/);
  assert.match(prompt, /no trouser legs, inseams or jeans construction/);
  assert.match(prompt, /black pleated midi skirt/);
});

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
