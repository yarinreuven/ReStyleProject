import type { NextFunction, Response } from "express";
import mongoose from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import OutfitSelection from "../models/OutfitSelection.ts";
import TryOnResult from "../models/TryOnResult.ts";

function hasAuthenticatedUser(req: AuthRequest, res: Response) {
  if (req.userId && mongoose.isValidObjectId(req.userId)) return true;

  res.status(401).json({ success: false, message: "Authentication is required" });
  return false;
}

export async function getSavedOutfits(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!hasAuthenticatedUser(req, res)) return;

    const results = await TryOnResult.find({
      owner: req.userId,
      status: "succeeded",
      savedAt: { $ne: null },
      "image.data": { $exists: true }
    })
      .sort({ savedAt: -1 })
      .populate({
        path: "selection",
        match: { user: req.userId },
        select: "title explanation stylingTips"
      })
      .populate({
        path: "items.item",
        match: { user: req.userId },
        select: "name category image"
      });

    const savedLooks = results.flatMap((result) => {
      const selection = result.selection as unknown as {
        _id: mongoose.Types.ObjectId;
        title: string;
        explanation: string;
        stylingTips: string[];
      } | null;
      if (!selection || !result.image?.data || !result.image.contentType) return [];

      return [{
        id: result._id,
        selectionId: selection._id,
        title: selection.title,
        explanation: selection.explanation,
        stylingTips: selection.stylingTips,
        image: `data:${result.image.contentType};base64,${result.image.data.toString("base64")}`,
        savedAt: result.savedAt,
        items: result.items.flatMap((entry) => {
          const item = entry.item as unknown as {
            _id: mongoose.Types.ObjectId;
            name: string;
            category: string;
            image?: { data?: Buffer; contentType?: string };
          } | null;
          if (!item) return [];
          return [{
            id: item._id,
            name: item.name,
            category: entry.detectedCategory || item.category,
            image: item.image?.data && item.image.contentType
              ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
              : ""
          }];
        })
      }];
    });

    res.json({ success: true, savedLooks });
  } catch (error) {
    next(error);
  }
}

export async function saveOutfit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!hasAuthenticatedUser(req, res)) return;

    const savedAt = new Date();
    const savedLook = await TryOnResult.findOneAndUpdate(
      {
        owner: req.userId,
        selection: req.body.selectionId,
        status: "succeeded",
        "image.data": { $exists: true }
      },
      { $set: { savedAt } },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!savedLook) {
      res.status(404).json({
        success: false,
        message: "A completed virtual look was not found for this account"
      });
      return;
    }

    await OutfitSelection.updateOne(
      { _id: savedLook.selection, user: req.userId },
      { $unset: { expiresAt: 1 } }
    );

    res.json({
      success: true,
      savedLookId: savedLook._id,
      savedAt: savedLook.savedAt
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedOutfit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!hasAuthenticatedUser(req, res)) return;

    const deletedLook = await TryOnResult.findOneAndDelete({
      _id: req.params.lookId,
      owner: req.userId,
      savedAt: { $ne: null }
    });
    if (!deletedLook) {
      res.status(404).json({ success: false, message: "The saved look was not found" });
      return;
    }

    await OutfitSelection.deleteOne({
      _id: deletedLook.selection,
      user: req.userId
    });

    res.json({ success: true, deletedLookId: deletedLook._id });
  } catch (error) {
    next(error);
  }
}
