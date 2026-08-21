import { Router } from "express";
import multer from "multer";
import {
  deleteProfileImage,
  deleteVirtualModelImage,
  getCurrentUser,
  getProfileImage,
  getVirtualModelImage,
  login,
  register,
  updateProfileImage,
  updateVirtualModelImage
} from "../controllers/authController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import {
  loginSchema,
  registerSchema
} from "../validation/authValidation.ts";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Please choose a JPG, PNG or WEBP image"));
  }
});

router.post(
  "/register",
  upload.single("profileImage"),
  validate(registerSchema),
  register
);

router.post(
  "/login",
  validate(loginSchema),
  login
);

router.get(
  "/me",
  authenticateToken,
  getCurrentUser
);

router.get(
  "/profile-image",
  authenticateToken,
  getProfileImage
);

router.put(
  "/profile-image",
  authenticateToken,
  upload.single("profileImage"),
  updateProfileImage
);

router.delete(
  "/profile-image",
  authenticateToken,
  deleteProfileImage
);

router.get(
  "/virtual-model-image",
  authenticateToken,
  getVirtualModelImage
);

router.put(
  "/virtual-model-image",
  authenticateToken,
  upload.single("virtualModelImage"),
  updateVirtualModelImage
);

router.delete(
  "/virtual-model-image",
  authenticateToken,
  deleteVirtualModelImage
);

export default router;
