import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sharp from "sharp";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { sendEmailChangeCode, sendPasswordResetEmail } from "../services/emailService.ts";
import { uploadedAvatarValidationError } from "../services/tryOnValidationService.ts";
import { deleteUserAccountData } from "../services/accountDeletionService.ts";
import {
  clearRefreshCookie,
  consumeRefreshSession,
  issueAuthSession,
  revokeAllRefreshSessions,
  revokeRefreshSession
} from "../services/authTokenService.ts";

const googleClient = new OAuth2Client();

export async function refreshAccessToken(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await consumeRefreshSession(req);
    if (!session) {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
      return;
    }
    const user = await User.findById(session.user).select("email");
    if (!user) {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
      return;
    }
    const token = await issueAuthSession(user, res);
    res.json({ success: true, token });
  } catch (error) {
    next(error);
  }
}

export async function logoutCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    await revokeRefreshSession(req);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function deleteCurrentUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (req.body.confirmation !== "DELETE") {
      res.status(400).json({ success: false, message: "Type DELETE to confirm account deletion" });
      return;
    }
    await deleteUserAccountData(req.userId!);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      res.status(404).json({ success: false, message: "Account not found" });
      return;
    }
    next(error);
  }
}

export async function getCurrentUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).select(
      "firstName lastName email language gender publicBio profileImage.contentType"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        gender: user.gender,
        publicBio: user.publicBio || "",
        hasProfileImage: Boolean(user.profileImage?.contentType)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        gender: req.body.gender
      },
      { new: true, runValidators: true }
    ).select("firstName lastName email language gender publicBio profileImage.contentType");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.json({
      success: true,
      message: "Personal information updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        gender: user.gender,
        publicBio: user.publicBio || "",
        hasProfileImage: Boolean(user.profileImage?.contentType)
      }
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: "This email address is already in use" });
      return;
    }
    next(error);
  }
}

export async function requestEmailChange(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findById(req.userId).select("firstName lastName email");

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    if (email === user.email) {
      res.status(400).json({ success: false, message: "Enter a different email address" });
      return;
    }
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      res.status(409).json({ success: false, message: "This email address is already in use" });
      return;
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    user.set({
      pendingEmail: email,
      emailVerificationCodeHash: crypto.createHash("sha256").update(code).digest("hex"),
      emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });
    await user.save();

    try {
      await sendEmailChangeCode(email, `${user.firstName} ${user.lastName}`.trim(), code);
    } catch (error) {
      user.set({ pendingEmail: null, emailVerificationCodeHash: null, emailVerificationExpiresAt: null });
      await user.save();
      throw error;
    }

    res.json({ success: true, message: "A verification code was sent to your new email address" });
  } catch (error) {
    next(error);
  }
}

export async function confirmEmailChange(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).select(
      "+pendingEmail +emailVerificationCodeHash +emailVerificationExpiresAt firstName lastName email language gender publicBio profileImage.contentType"
    );
    const codeHash = crypto.createHash("sha256").update(req.body.code).digest("hex");

    if (!user?.pendingEmail || !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt.getTime() < Date.now() ||
      codeHash !== user.emailVerificationCodeHash) {
      res.status(400).json({ success: false, message: "The verification code is invalid or has expired" });
      return;
    }
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
      res.status(409).json({ success: false, message: "This email address is already in use" });
      return;
    }

    user.email = user.pendingEmail;
    user.set({ pendingEmail: null, emailVerificationCodeHash: null, emailVerificationExpiresAt: null });
    await user.save();

    res.json({
      success: true,
      message: "Email address updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        gender: user.gender,
        publicBio: user.publicBio || "",
        hasProfileImage: Boolean(user.profileImage?.contentType)
      }
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: "This email address is already in use" });
      return;
    }
    next(error);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).select("password");

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const passwordIsCorrect = user.password.startsWith("$2")
      ? await bcrypt.compare(req.body.currentPassword, user.password)
      : user.password === req.body.currentPassword;

    if (!passwordIsCorrect) {
      res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
      return;
    }

    const matchesCurrentPassword = user.password.startsWith("$2")
      ? await bcrypt.compare(req.body.newPassword, user.password)
      : req.body.newPassword === user.password;

    if (matchesCurrentPassword) {
      res.status(400).json({
        success: false,
        message: "New password must be different from your current password"
      });
      return;
    }

    user.password = await bcrypt.hash(req.body.newPassword, 10);
    await user.save();
    await revokeAllRefreshSessions(user._id.toString());
    clearRefreshCookie(res);

    res.json({ success: true, message: "Password updated successfully. Please log in again." });
  } catch (error) {
    next(error);
  }
}

export async function getBlockedUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).populate(
      "blockedUsers",
      "firstName lastName profileImage"
    );

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const blockedUsers = (user.blockedUsers as any[]).map((blockedUser) => ({
      id: blockedUser._id,
      firstName: blockedUser.firstName,
      lastName: blockedUser.lastName,
      hasProfileImage: Boolean(blockedUser.profileImage?.contentType)
    }));

    res.json({ success: true, blockedUsers });
  } catch (error) {
    next(error);
  }
}

export async function blockUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const targetUserId = req.params.userId;

    if (String(targetUserId) === String(req.userId)) {
      res.status(400).json({ success: false, message: "You cannot block yourself" });
      return;
    }

    if (!await User.exists({ _id: targetUserId })) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { blockedUsers: targetUserId }
    });

    res.json({
      success: true,
      message: "User blocked successfully"
    });
  } catch (error) {
    next(error);
  }
}

export async function unblockUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $pull: { blockedUsers: req.params.userId } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    next(error);
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      language,
      gender
    } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Account already exists"
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      language,
      gender,
      profileImage: req.file
        ? {
            data: req.file.buffer,
            contentType: req.file.mimetype
          }
        : undefined
    });

    const token = await issueAuthSession(newUser, res);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        language: newUser.language,
        gender: newUser.gender,
        hasProfileImage: Boolean(req.file)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfileImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).select("profileImage");

    if (
      !user ||
      !user.profileImage?.data ||
      !user.profileImage.contentType
    ) {
      res.status(404).json({
        success: false,
        message: "Profile image not found"
      });
      return;
    }

    res.set("Content-Type", user.profileImage.contentType);
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.send(user.profileImage.data);
  } catch (error) {
    next(error);
  }
}

export async function updateProfileImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please choose a profile image"
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        profileImage: {
          data: req.file.buffer,
          contentType: req.file.mimetype
        }
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      hasProfileImage: true
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProfileImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $unset: { profileImage: 1 } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile image removed successfully",
      hasProfileImage: false
    });
  } catch (error) {
    next(error);
  }
}

export async function getVirtualModelImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.userId).select("virtualModelImage");

    if (
      !user ||
      !user.virtualModelImage?.data ||
      !user.virtualModelImage.contentType
    ) {
      res.status(404).json({
        success: false,
        message: "Virtual model image not found"
      });
      return;
    }

    res.set("Content-Type", user.virtualModelImage.contentType);
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.send(user.virtualModelImage.data);
  } catch (error) {
    next(error);
  }
}

export async function updateVirtualModelImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please choose a full-body image"
      });
      return;
    }

    let metadata;
    try {
      metadata = await sharp(req.file.buffer).metadata();
    } catch {
      res.status(400).json({
        success: false,
        message: "This photo could not be read. Please choose a different clear full-body photo."
      });
      return;
    }

    const validationError = uploadedAvatarValidationError({
      declaredMimeType: req.file.mimetype,
      detectedFormat: metadata.format,
      size: req.file.size,
      width: metadata.width,
      height: metadata.height
    });
    if (validationError) {
      res.status(400).json({
        success: false,
        code: "VIRTUAL_MODEL_PHOTO_UNSUITABLE",
        message: `${validationError}. Replace it before creating a look.`
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        virtualModelImage: {
          data: req.file.buffer,
          contentType: req.file.mimetype
        }
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.json({
      success: true,
      message: "Virtual model image updated successfully"
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteVirtualModelImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $unset: { virtualModelImage: 1 } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.json({
      success: true,
      message: "Virtual model image removed successfully"
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Incorrect email or password"
      });
      return;
    }

    const passwordIsHashed = user.password.startsWith("$2");

    let passwordIsCorrect = false;

    if (passwordIsHashed) {
      passwordIsCorrect = await bcrypt.compare(
        password,
        user.password
      );
    } else {
      passwordIsCorrect = user.password === password;

      if (passwordIsCorrect) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!passwordIsCorrect) {
      res.status(401).json({
        success: false,
        message: "Incorrect email or password"
      });
      return;
    }

    const token = await issueAuthSession(user, res);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        gender: user.gender || "female",
        hasProfileImage: Boolean(user.profileImage?.data)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();

    if (!googleClientId) {
      throw new Error("GOOGLE_CLIENT_ID is missing");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: googleClientId
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      res.status(401).json({
        success: false,
        message: "Google account could not be verified"
      });
      return;
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email }]
    });

    if (user) {
      if (req.body.intent === "register") {
        res.status(409).json({ success: false, message: "An account with this email already exists" });
        return;
      }
      if (user.googleId && user.googleId !== payload.sub) {
        res.status(409).json({
          success: false,
          message: "This email is linked to another Google account"
        });
        return;
      }

      if (!user.googleId) {
        user.googleId = payload.sub;
        await user.save();
      }
    } else {
      if (req.body.intent === "login") {
        res.status(404).json({ success: false, code: "ACCOUNT_NOT_FOUND", message: "No account exists for this Google email. Please register first." });
        return;
      }
      const firstName = (payload.given_name || payload.name || "ReStyle").trim().slice(0, 50);
      const lastName = (payload.family_name || "Member").trim().slice(0, 50);
      const generatedPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10
      );

      user = await User.create({
        googleId: payload.sub,
        firstName: firstName.length >= 2 ? firstName : "ReStyle",
        lastName: lastName.length >= 2 ? lastName : "Member",
        email,
        password: generatedPassword,
        language: "en",
        gender: "unspecified"
      });
    }

    const token = await issueAuthSession(user, res);

    res.json({
      success: true,
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        gender: user.gender,
        hasProfileImage: Boolean(user.profileImage?.data)
      }
    });
  } catch (error) {
    if (error instanceof Error && /token|audience|signature|issuer/i.test(error.message)) {
      res.status(401).json({
        success: false,
        message: "Google sign-in failed. Please try again."
      });
      return;
    }
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const genericResponse = {
    success: true,
    message: "If an account exists for this email, a password reset link has been sent."
  };

  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      res.json(genericResponse);
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetTokenHash = resetTokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetUrl
      );
    } catch (emailError) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      await user.save();
      throw emailError;
    }

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(req.body.token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetTokenHash: resetTokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select("+passwordResetTokenHash +passwordResetExpiresAt password");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "This password reset link is invalid or has expired"
      });
      return;
    }

    const matchesCurrentPassword = user.password.startsWith("$2")
      ? await bcrypt.compare(req.body.newPassword, user.password)
      : req.body.newPassword === user.password;

    if (matchesCurrentPassword) {
      res.status(400).json({
        success: false,
        message: "New password must be different from your current password"
      });
      return;
    }

    user.password = await bcrypt.hash(req.body.newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    await revokeAllRefreshSessions(user._id.toString());

    res.json({
      success: true,
      message: "Password reset successfully. You can now log in."
    });
  } catch (error) {
    next(error);
  }
}
