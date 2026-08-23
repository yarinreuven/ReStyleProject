import type { NextFunction, Response } from "express";
import type { Error as MongooseError } from "mongoose";

import type { AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import MarketplaceFavorite from "../models/MarketplaceFavorite.ts";

function imageToDataUrl(image?: { data?: Buffer; contentType?: string } | null) {
  if (!image?.data || !image.contentType) {
    return "";
  }

  return `data:${image.contentType};base64,${image.data.toString("base64")}`;
}

function formatMarketplaceItem(item: any) {
  const object = item.toObject ? item.toObject() : item;
  const uploadedImages = (object.marketplaceImages || [])
    .map(imageToDataUrl)
    .filter(Boolean);
  const closetImage = imageToDataUrl(object.image);
  const images = uploadedImages.length > 0
    ? uploadedImages
    : closetImage ? [closetImage] : [];
  const seller = object.user;

  return {
    _id: object._id,
    name: object.name,
    listingType: object.listingType,
    price: object.price,
    rentalPricePerDay: object.rentalPricePerDay,
    size: object.size,
    condition: object.condition,
    category: object.category,
    brand: object.brand,
    style: object.style,
    description: object.description,
    images,
    createdAt: object.createdAt,
    availabilityStatus: object.availabilityStatus,
    seller: seller ? {
      id: seller._id,
      name: `${seller.firstName} ${seller.lastName}`.trim(),
      avatar: imageToDataUrl(seller.profileImage)
    } : null
  };
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === 11000;
}

export async function getMarketplaceFavorites(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const favorites = await MarketplaceFavorite.find({ user: req.userId })
      .populate({
        path: "item",
        populate: {
          path: "user",
          select: "firstName lastName profileImage"
        }
      })
      .sort({ createdAt: -1 });

    const items = favorites
      .map((favorite: any) => favorite.item)
      .filter((item: any) => item && ["sale", "rent"].includes(item.listingType))
      .map(formatMarketplaceItem);

    res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
}

export async function addMarketplaceFavorite(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const item = await Item.findById(req.params.itemId).select(
      "listingType availabilityStatus"
    );

    if (!item) {
      res.status(404).json({ success: false, message: "Marketplace item not found" });
      return;
    }

    if (!["sale", "rent"].includes(item.listingType as string)) {
      res.status(400).json({
        success: false,
        message: "This item is not published in the marketplace"
      });
      return;
    }

    await MarketplaceFavorite.create({
      user: req.userId,
      item: item._id
    });

    res.status(201).json({
      success: true,
      message: "Marketplace item saved to favorites"
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This marketplace item is already in your favorites"
      });
      return;
    }

    next(error as MongooseError);
  }
}

export async function removeMarketplaceFavorite(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const favorite = await MarketplaceFavorite.findOneAndDelete({
      user: req.userId,
      item: req.params.itemId
    });

    if (!favorite) {
      res.status(404).json({
        success: false,
        message: "Marketplace favorite not found"
      });
      return;
    }

    res.json({
      success: true,
      message: "Marketplace item removed from favorites"
    });
  } catch (error) {
    next(error);
  }
}
