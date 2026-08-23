import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }],
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null
    },
    messages: {
      type: [messageSchema],
      default: []
    },
    readState: [{
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      lastReadAt: { type: Date, default: Date.now }
    }],
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ item: 1, participants: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
