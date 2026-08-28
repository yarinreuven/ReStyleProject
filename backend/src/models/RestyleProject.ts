import mongoose from "mongoose";

const restyleDetailsSchema = new mongoose.Schema(
  {
    garmentType: { type: String, required: true, trim: true },
    fabric: { type: String, required: true, trim: true },
    condition: { type: String, required: true, trim: true },
    sewingSkill: { type: String, required: true, trim: true },
    tools: { type: [{ type: String, trim: true }], required: true },
    difficulty: { type: String, required: true, trim: true },
    preference: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const restyleGuideSchema = new mongoose.Schema(
  {
    steps: {
      type: [{ id: String, title: String, instruction: String }],
      default: []
    },
    tips: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    verifiedVideo: { type: mongoose.Schema.Types.Mixed, default: null },
    videoSearch: {
      title: { type: String, default: "" },
      url: { type: String, default: "" }
    }
  },
  { _id: false }
);

const restyleIdeaSchema = new mongoose.Schema(
  {
    ideaId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Challenging"], required: true },
    outputType: { type: String, enum: ["clothing", "bag", "accessory", "home"], required: true },
    timeMinutes: { type: Number, min: 1, required: true },
    sewingRequired: { type: Boolean, required: true },
    requiredTools: { type: [String], default: [] },
    materials: { type: [String], default: [] },
    suitableConditions: { type: [String], default: [] },
    icon: { type: String, required: true },
    whyItFits: { type: String, required: true },
    matchScore: { type: Number, min: 0, max: 100, default: 75 },
    matchLabel: { type: String, enum: ["Best match", "Great match", "Good match"], default: "Good match" },
    generatedGuide: { type: restyleGuideSchema, default: undefined }
  },
  { _id: false }
);

const restyleProjectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    status: {
      type: String,
      enum: ["saved", "in_progress", "completed"],
      default: "saved",
      index: true
    },
    sourceType: {
      type: String,
      enum: ["closet", "upload"],
      required: true
    },
    sourceItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null
    },
    sourceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    sourceImage: {
      data: Buffer,
      contentType: String
    },
    detectedGarmentType: {
      type: String,
      default: ""
    },
    imageValidatedAt: {
      type: Date,
      default: null
    },
    details: {
      type: restyleDetailsSchema,
      required: true
    },
    selectedIdeaId: {
      type: String,
      default: null
    },
    generatedIdeas: {
      type: [restyleIdeaSchema],
      default: []
    },
    ideaCatalogVersion: {
      type: Number,
      min: 0,
      default: 0
    },
    completedStepIds: {
      type: [{ type: String, trim: true }],
      default: []
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    completedAt: {
      type: Date,
      default: null
    },
    resultImage: {
      data: Buffer,
      contentType: String
    }
  },
  { timestamps: true }
);

restyleProjectSchema.index({ owner: 1, updatedAt: -1 });

const RestyleProject = mongoose.model("RestyleProject", restyleProjectSchema);

export default RestyleProject;
