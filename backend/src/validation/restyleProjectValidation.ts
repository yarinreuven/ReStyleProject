import type { NextFunction, Response } from "express";
import Joi from "joi";

import type { AuthRequest } from "../middleware/auth.ts";

const objectId = Joi.string().hex().length(24);
const detailsSchema = Joi.object({
  garmentType: Joi.string().trim().min(2).max(40).required(),
  fabric: Joi.string().trim().min(2).max(40).required(),
  condition: Joi.string().valid("good", "stained", "torn", "too-small", "too-large", "worn").required(),
  sewingSkill: Joi.string().valid("No sewing", "Basic hand sewing", "Confident", "Advanced").required(),
  tools: Joi.array().items(Joi.string().trim().min(2).max(40)).min(1).max(8).required(),
  difficulty: Joi.string().valid("Easy", "Medium", "Challenging").required(),
  preference: Joi.string().valid("clothing", "bag", "accessory", "home", "any").required()
});

const createSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  sourceType: Joi.string().valid("closet", "upload").required(),
  sourceItemId: objectId.when("sourceType", { is: "closet", then: Joi.required(), otherwise: Joi.forbidden() }),
  sourceName: Joi.string().trim().min(1).max(120).required(),
  details: detailsSchema.required()
});

export const updateRestyleProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  status: Joi.string().valid("saved", "in_progress", "completed"),
  details: detailsSchema,
  selectedIdeaId: Joi.string().trim().min(1).max(120).allow(null),
  completedStepIds: Joi.array().items(Joi.string().trim().min(1).max(120)).max(50),
  progress: Joi.number().integer().min(0).max(100)
}).min(1);

export function validateRestyleProjectCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const normalizedBody = {
      ...req.body,
      details: typeof req.body.details === "string"
        ? JSON.parse(req.body.details)
        : req.body.details
    };
    const { error, value } = createSchema.validate(normalizedBody, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      res.status(400).json({ success: false, message: error.details.map((detail) => detail.message).join(", ") });
      return;
    }
    req.body = value;
    next();
  } catch {
    res.status(400).json({ success: false, message: "Garment details must be valid JSON" });
  }
}

const restyleProjectIdSchema = Joi.object({
  projectId: objectId.required()
});

export function validateRestyleProjectId(req: AuthRequest, res: Response, next: NextFunction) {
  const { error, value } = restyleProjectIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });
  if (error) {
    res.status(400).json({ success: false, message: error.details[0]?.message });
    return;
  }
  req.params = value;
  next();
}
