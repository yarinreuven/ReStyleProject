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

    language: {
      type: String,
      default: "en"
    },

    gender: {
      type: String,
      enum: ["female", "male"],
      default: "female"
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
    }]
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
