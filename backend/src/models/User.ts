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

    freeTryOnsUsed: {
      type: Number,
      default: 0,
      min: 0,
      max: 3
    },

    tryOnCredits: {
      type: Number,
      default: 0,
      min: 0
    },

    restyleFreeUses: {
      type: Number,
      default: 0,
      min: 0,
      max: 3
    },

    restyleCredits: {
      type: Number,
      default: 0,
      min: 0
    },

    restyleSubscriptionPlan: {
      type: String,
      enum: ["free", "mini", "style"],
      default: "free"
    },

    subscriptionPlan: {
      type: String,
      enum: ["free", "mini", "style"],
      default: "free"
    },

    completedPayPalOrderIds: {
      type: [String],
      default: [],
      select: false
    },

    tryOnReservations: {
      type: [{
        token: { type: String, required: true },
        type: { type: String, enum: ["free", "credit"], required: true },
        createdAt: { type: Date, required: true }
      }],
      default: [],
      select: false
    },

    completedTryOnRequestKeys: {
      type: [String],
      default: [],
      select: false
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
    },

    pendingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      select: false
    },

    emailVerificationCodeHash: {
      type: String,
      default: null,
      select: false
    },

    emailVerificationExpiresAt: {
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
