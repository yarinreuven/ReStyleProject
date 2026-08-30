import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  GEMINI_WARDROBE_IMAGE_MODEL,
  InvalidWardrobeImageError,
  optimizeWardrobeImage
} from "./wardrobeImageService.ts";

function createUpload(buffer: Buffer, overrides: Partial<Express.Multer.File> = {}) {
  return {
    fieldname: "image",
    originalname: "wardrobe.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: buffer.length,
    destination: "",
    filename: "",
    path: "",
    buffer,
    ...overrides
  } as Express.Multer.File;
}

test("optimizes wardrobe uploads as bounded JPEG files", async () => {
  const source = await sharp({
    create: {
      width: 2400,
      height: 1200,
      channels: 4,
      background: { r: 180, g: 90, b: 120, alpha: 1 }
    }
  }).png().toBuffer();

  const optimized = await optimizeWardrobeImage(createUpload(source));
  const metadata = await sharp(optimized.buffer).metadata();

  assert.equal(optimized.mimetype, "image/jpeg");
  assert.equal(optimized.size, optimized.buffer.length);
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
});

test("does not enlarge small wardrobe uploads", async () => {
  const source = await sharp({
    create: {
      width: 320,
      height: 480,
      channels: 3,
      background: { r: 230, g: 230, b: 230 }
    }
  }).png().toBuffer();

  const optimized = await optimizeWardrobeImage(createUpload(source));
  const metadata = await sharp(optimized.buffer).metadata();

  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 480);
  assert.equal(optimized.originalname, "wardrobe.png");
  assert.equal(optimized.fieldname, "image");
});

test("rejects files whose bytes are not a valid image", async () => {
  const upload = createUpload(Buffer.from("not an image"));

  await assert.rejects(
    optimizeWardrobeImage(upload),
    InvalidWardrobeImageError
  );
});

test("uses the low-latency multimodal model for wardrobe classification", () => {
  assert.equal(GEMINI_WARDROBE_IMAGE_MODEL, "gemini-3.1-flash-lite");
});
