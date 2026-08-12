import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.ts";

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
      language
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
      language
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
        language: newUser.language
      }
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
        language: user.language
      }
    });
  } catch (error) {
    next(error);
  }
}