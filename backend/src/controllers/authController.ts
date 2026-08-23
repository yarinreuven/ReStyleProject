import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.ts";
import type { AuthRequest } from "../middleware/auth.ts";

function createToken(userId: string, email: string) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing");
  }

  return jwt.sign(
    { userId, email },
    jwtSecret,
    { expiresIn: "7d" }
  );
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
        lastName: req.body.lastName
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
      message: "Name updated successfully",
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

    res.json({ success: true, message: "Password updated successfully" });
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

    const token = createToken(
      newUser._id.toString(),
      newUser.email
    );

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

    const token = createToken(
      user._id.toString(),
      user.email
    );

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
