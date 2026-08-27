import type { NextFunction, Response } from "express";

import Item from "../models/Item.ts";
import RestyleProject from "../models/RestyleProject.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { personalizeRestyleIdeas } from "../services/restyleAiService.ts";
import { findMatchingRestyleIdeas, getResponsibleFallback, getVerifiedRestyleGuide, RESTYLE_CATALOG_VERSION } from "../services/restyleIdeaService.ts";

const RESTYLE_INACTIVE_DAYS = 60;
const restyleCategories = new Set(["Tops", "Bottoms", "Dresses", "Jackets"]);
const compatibleClosetTypes: Record<string, Set<string>> = {
  Tops: new Set(["Tops", "Shirts", "Sweaters"]),
  Bottoms: new Set(["Bottoms", "Skirts"]),
  Dresses: new Set(["Dresses"]),
  Jackets: new Set(["Jackets"])
};

function detailsMatchClosetCategory(category: string, garmentType: string) {
  return compatibleClosetTypes[category]?.has(garmentType) === true;
}

function imageToDataUrl(image?: { data?: Buffer; contentType?: string } | null) {
  if (!image?.data || !image.contentType) return "";
  return `data:${image.contentType};base64,${image.data.toString("base64")}`;
}

function serializeProject(project: any) {
  const sourceItem = project.sourceItem && typeof project.sourceItem === "object"
    ? project.sourceItem
    : null;
  return {
    id: project._id,
    name: project.name,
    status: project.status,
    sourceType: project.sourceType,
    sourceItemId: sourceItem?._id || project.sourceItem || null,
    sourceName: project.sourceName,
    sourceCategory: sourceItem?.category || "",
    sourceImage: sourceItem
      ? imageToDataUrl(sourceItem.image)
      : imageToDataUrl(project.sourceImage),
    details: project.details,
    selectedIdeaId: project.selectedIdeaId,
    generatedIdeas: project.generatedIdeas || [],
    ideaCatalogVersion: project.ideaCatalogVersion || 0,
    completedStepIds: project.completedStepIds,
    progress: project.progress,
    completedAt: project.completedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function isEligibleClosetItem(item: any) {
  const referenceDate = item.lastWornAt || item.createdAt;
  const age = Date.now() - new Date(referenceDate).getTime();
  return restyleCategories.has(item.category) && age >= RESTYLE_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
}

export async function createRestyleProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let sourceItem = null;
    let sourceImage = undefined;

    if (req.body.sourceType === "closet") {
      sourceItem = await Item.findOne({ _id: req.body.sourceItemId, user: req.userId });
      if (!sourceItem) {
        res.status(404).json({ success: false, message: "Closet item not found" });
        return;
      }
      if (!sourceItem.image?.data || !isEligibleClosetItem(sourceItem)) {
        res.status(400).json({ success: false, message: "This closet item is not currently eligible for ReStyle Studio" });
        return;
      }
      if (!detailsMatchClosetCategory(sourceItem.category, req.body.details.garmentType)) {
        res.status(400).json({ success: false, message: "The selected garment type does not match this closet item" });
        return;
      }
    } else {
      if (!req.file) {
        res.status(400).json({ success: false, message: "A garment image is required" });
        return;
      }
      sourceImage = { data: req.file.buffer, contentType: req.file.mimetype };
    }

    const project = await RestyleProject.create({
      owner: req.userId,
      name: req.body.name,
      sourceType: req.body.sourceType,
      sourceItem: sourceItem?._id || null,
      sourceName: req.body.sourceName,
      sourceImage,
      details: req.body.details
    });

    await project.populate("sourceItem", "name category image");
    res.status(201).json({ success: true, project: serializeProject(project) });
  } catch (error) {
    next(error);
  }
}

export async function getRestyleProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projects = await RestyleProject.find({ owner: req.userId })
      .sort({ updatedAt: -1 })
      .populate("sourceItem", "name category image");
    res.json({ success: true, projects: projects.map(serializeProject) });
  } catch (error) {
    next(error);
  }
}

export async function getRestyleProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await RestyleProject.findOne({ _id: req.params.projectId, owner: req.userId })
      .populate("sourceItem", "name category image");
    if (!project) {
      res.status(404).json({ success: false, message: "ReStyle project not found" });
      return;
    }
    res.json({ success: true, project: serializeProject(project) });
  } catch (error) {
    next(error);
  }
}

export async function updateRestyleProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const updates = { ...req.body };
    const existingProject = updates.details
      ? await RestyleProject.findOne({ _id: req.params.projectId, owner: req.userId }).populate("sourceItem", "category")
      : null;
    const sourceItem = existingProject?.sourceItem as any;
    if (
      existingProject?.sourceType === "closet" &&
      sourceItem?.category &&
      !detailsMatchClosetCategory(sourceItem.category, updates.details.garmentType)
    ) {
      res.status(400).json({ success: false, message: "The selected garment type does not match this closet item" });
      return;
    }
    if (updates.status === "completed") {
      updates.progress = 100;
      updates.completedAt = new Date();
    } else if (updates.status) {
      updates.completedAt = null;
    }
    if (updates.details) {
      updates.generatedIdeas = [];
      updates.ideaCatalogVersion = 0;
      updates.selectedIdeaId = null;
      updates.completedStepIds = [];
      updates.progress = 0;
      updates.status = "saved";
      updates.completedAt = null;
    }
    const project = await RestyleProject.findOneAndUpdate(
      { _id: req.params.projectId, owner: req.userId },
      updates,
      { new: true, runValidators: true }
    ).populate("sourceItem", "name category image");
    if (!project) {
      res.status(404).json({ success: false, message: "ReStyle project not found" });
      return;
    }
    res.json({ success: true, project: serializeProject(project) });
  } catch (error) {
    next(error);
  }
}

export async function deleteRestyleProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await RestyleProject.findOneAndDelete({ _id: req.params.projectId, owner: req.userId });
    if (!project) {
      res.status(404).json({ success: false, message: "ReStyle project not found" });
      return;
    }
    res.json({ success: true, message: "ReStyle project deleted" });
  } catch (error) {
    next(error);
  }
}

export async function generateRestyleIdeas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await RestyleProject.findOne({ _id: req.params.projectId, owner: req.userId })
      .populate("sourceItem", "image");
    if (!project) {
      res.status(404).json({ success: false, message: "ReStyle project not found" });
      return;
    }

    const cachedIdeas = (project.generatedIdeas || []).map((entry: any) => {
      const idea = typeof entry.toObject === "function" ? entry.toObject() : entry;
      return { ...idea, id: idea.ideaId };
    });
    const fallback = getResponsibleFallback(project.details);
    if (cachedIdeas.length > 0 && project.ideaCatalogVersion === RESTYLE_CATALOG_VERSION) {
      res.json({
        success: true,
        ideas: cachedIdeas,
        fallback,
        message: `${cachedIdeas.length} suitable paths, ranked for this garment`
      });
      return;
    }

    const curatedIdeas = findMatchingRestyleIdeas(project.details);
    const sourceItem = project.sourceItem && typeof project.sourceItem === "object"
      ? project.sourceItem as any
      : null;
    const sourceImage = sourceItem?.image?.data
      ? sourceItem.image
      : project.sourceImage;
    const ideas = await personalizeRestyleIdeas(project.details, curatedIdeas, sourceImage);
    project.set("generatedIdeas", ideas.map((idea) => ({ ...idea, ideaId: idea.id })));
    project.ideaCatalogVersion = RESTYLE_CATALOG_VERSION;
    await project.save();

    res.json({
      success: true,
      ideas,
      fallback,
      message: ideas.length > 0
        ? `${ideas.length} suitable paths, ranked for this garment`
        : "A creative transformation is not safe with the current details, so we prepared a responsible next path"
    });
  } catch (error) {
    next(error);
  }
}

export async function selectRestyleIdea(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ideaId = String(req.params.ideaId);
    const project = await RestyleProject.findOne({ _id: req.params.projectId, owner: req.userId });
    if (!project) {
      res.status(404).json({ success: false, message: "ReStyle project not found" });
      return;
    }
    const generatedIdea = project.generatedIdeas.find((idea) => idea.ideaId === ideaId);
    const guide = getVerifiedRestyleGuide(ideaId);
    if (!generatedIdea || !guide) {
      res.status(404).json({ success: false, message: "This guide is not available for the project" });
      return;
    }

    project.selectedIdeaId = ideaId;
    project.status = "in_progress";
    await project.save();

    res.json({
      success: true,
      guide,
      completedStepIds: project.completedStepIds,
      progress: project.progress,
      status: project.status
    });
  } catch (error) {
    next(error);
  }
}
