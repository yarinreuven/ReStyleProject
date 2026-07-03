import express from "express";
import cors from "cors";
import User from "./models/User.ts";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReStyle API is running");
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, language } = req.body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Account already exists"
      });
    }

    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password,
      language
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        language: newUser.language
      }
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account does not exist"
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language
      }
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

export default app;