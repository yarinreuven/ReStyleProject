/** Calculates image dimensions bounded by a maximum side without enlargement. */
export function scaledImageDimensions(width, height, maxDimension = 1600) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** Resizes and compresses a wardrobe image in the browser before upload. */
export async function optimizeWardrobeUpload(file) {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const dimensions = scaledImageDimensions(bitmap.width, bitmap.height);
    if (file.size <= 750 * 1024 && dimensions.width === bitmap.width && dimensions.height === bitmap.height) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("IMAGE_COMPRESSION_FAILED")),
        "image/jpeg",
        0.82
      );
    });
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "wardrobe-item";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified
    });
  } finally {
    bitmap.close();
  }
}
