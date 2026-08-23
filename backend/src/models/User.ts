import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined
    },

    language: {
      type: String,
      default: "en"
    },

    gender: {
      type: String,
      enum: ["female", "male", "unspecified"],
      default: "unspecified"
    },

    publicBio: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    },

    profileImage: {
      data: Buffer,
      contentType: String
    },

    virtualModelImage: {
      data: Buffer,
      contentType: String
    },

    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],

    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
