import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import mongoose from "mongoose";
import {
  blockUser,
  changePassword,
  confirmEmailChange,
  deleteProfileImage,
  deleteCurrentUser,
  deleteVirtualModelImage,
  forgotPassword,
  getCurrentUser,
  getProfileImage,
  getVirtualModelImage,
  getBlockedUsers,
  googleAuth,
  login,
  logoutCurrentUser,
  refreshAccessToken,
  register,
  resetPassword,
  requestEmailChange,
  unblockUser,
  updateCurrentUser,
  updateProfileImage,
  updateVirtualModelImage
} from "../controllers/authController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import {
  changePasswordSchema,
  confirmEmailChangeSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  requestEmailChangeSchema,
  updateProfileSchema
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

router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutCurrentUser);

router.post(
  "/google",
  validate(googleAuthSchema),
  googleAuth
);

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPassword
);

router.get(
  "/me",
  authenticateToken,
  getCurrentUser
);

router.put(
  "/me",
  authenticateToken,
  validate(updateProfileSchema),
  updateCurrentUser
);

router.delete(
  "/me",
  authenticateToken,
  deleteCurrentUser
);

router.put(
  "/password",
  authenticateToken,
  validate(changePasswordSchema),
  changePassword
);

router.post(
  "/email-change/request",
  authenticateToken,
  validate(requestEmailChangeSchema),
  requestEmailChange
);

router.post(
  "/email-change/confirm",
  authenticateToken,
  validate(confirmEmailChangeSchema),
  confirmEmailChange
);

router.get(
  "/blocked-users",
  authenticateToken,
  getBlockedUsers
);

function validateUserId(req: Request, res: Response, next: NextFunction) {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    res.status(400).json({ success: false, message: "Invalid user ID" });
    return;
  }
  next();
}

router.post(
  "/blocked-users/:userId",
  authenticateToken,
  validateUserId,
  blockUser
);

router.delete(
  "/blocked-users/:userId",
  authenticateToken,
  validateUserId,
  unblockUser
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
