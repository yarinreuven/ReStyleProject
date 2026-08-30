import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import { validateWardrobeImage } from "../services/wardrobeImageService.ts";

function serializeItem(item: InstanceType<typeof Item>) {
  const itemObject = item.toObject();
  const image = item.image?.data && item.image.contentType
    ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
    : "";

  return {
    ...itemObject,
    wornDates: itemObject.wornDates?.length
      ? itemObject.wornDates
      : itemObject.lastWornAt
        ? [itemObject.lastWornAt]
        : [],
    image
  };
}

export async function createItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Please upload an image of the item" });
      return;
    }

    const { name, category, color, season, style, favorite } = req.body;
    const imageValidation = await validateWardrobeImage(req.file, category);
    if (!imageValidation.valid) {
      res.status(400).json({ success: false, message: imageValidation.message });
      return;
    }

    const item = await Item.create({
      user: req.userId,
      name,
      category,
      color,
      season,
      style,
      favorite,
      image: { data: req.file.buffer, contentType: req.file.mimetype }
    });

    res.status(201).json({ success: true, message: "Item added successfully", item });
  } catch (error) {
    next(error);
  }
}

export async function getItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await Item.find({ user: req.userId, listingType: null })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, items: items.map(serializeItem) });
  } catch (error) {
    next(error);
  }
}

export async function updateFavorite(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: null
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }

    item.favorite = req.body.favorite;
    await item.save();
    res.status(200).json({ success: true, message: "Favorite updated successfully", item });
  } catch (error) {
    next(error);
  }
}

export async function addWornDate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selectedDate = req.body.date ? new Date(`${req.body.date}T12:00:00`) : new Date();
    if (Number.isNaN(selectedDate.getTime()) || selectedDate.getTime() > Date.now()) {
      res.status(400).json({
        success: false,
        message: "Please choose a valid date that is not in the future"
      });
      return;
    }

    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: null
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }

    const dateKey = selectedDate.toISOString().slice(0, 10);
    const wornDates = (item.wornDates || []).map((date) => new Date(date as unknown as string));
    if (wornDates.length === 0 && item.lastWornAt) wornDates.push(new Date(item.lastWornAt));
    const alreadyMarked = wornDates.some((date) => date.toISOString().slice(0, 10) === dateKey);

    if (!alreadyMarked) {
      wornDates.push(selectedDate);
      wornDates.sort((first, second) => first.getTime() - second.getTime());
      item.set("wornDates", wornDates);
      item.wearCount = wornDates.length;
      item.lastWornAt = wornDates[wornDates.length - 1] || null;
      await item.save();
    }

    res.status(200).json({
      success: true,
      message: alreadyMarked ? "This wear date is already recorded" : "Wear date added successfully",
      alreadyMarked,
      item
    });
  } catch (error) {
    next(error);
  }
}

export async function removeWornDate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: null
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }

    const existingWornDates = (item.wornDates || [])
      .map((wornDate) => new Date(wornDate as unknown as string));
    if (existingWornDates.length === 0 && item.lastWornAt) {
      existingWornDates.push(new Date(item.lastWornAt));
    }
    const wornDates = existingWornDates.filter(
      (wornDate) => wornDate.toISOString().slice(0, 10) !== req.body.date
    );
    item.set("wornDates", wornDates);
    item.wearCount = wornDates.length;
    item.lastWornAt = wornDates[wornDates.length - 1] || null;
    await item.save();

    res.status(200).json({ success: true, message: "Wear date removed successfully", item });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: null
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }

    const { name, category, color, season, style } = req.body;
    if (name !== undefined) item.name = name;
    if (category !== undefined) item.category = category;
    if (color !== undefined) item.color = color;
    if (season !== undefined) item.season = season;
    if (style !== undefined) item.style = style;

    if (req.file) {
      const imageValidation = await validateWardrobeImage(req.file, category || item.category);
      if (!imageValidation.valid) {
        res.status(400).json({ success: false, message: imageValidation.message });
        return;
      }
      item.image = { data: req.file.buffer, contentType: req.file.mimetype };
    }

    await item.save();
    res.status(200).json({ success: true, message: "Item updated successfully", item });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const deletedItem = await Item.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
      listingType: null
    });
    if (!deletedItem) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    next(error);
  }
}
