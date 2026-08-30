import multer from "multer";

const ALLOWED_TRY_ON_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

export const tryOnImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_TRY_ON_IMAGE_TYPES.includes(file.mimetype)) {
      callback(new Error("The virtual model must be a JPG, PNG or WEBP image"));
      return;
    }

    callback(null, true);
  }
});
