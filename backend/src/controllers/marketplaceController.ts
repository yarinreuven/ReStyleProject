import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import User from "../models/User.ts";
import {
  checkWardrobeImage,
  type ImageCheckResult
} from "../services/wardrobeImageService.ts";

function imageToDataUrl(image?: { data?: Buffer; contentType?: string } | null) {
  return image?.data && image.contentType
    ? `data:${image.contentType};base64,${image.data.toString("base64")}`
    : "";
}

function formatMarketplaceItem(item: any) {
  const object = item.toObject ? item.toObject() : item;
  const uploadedImages = (object.marketplaceImages || []).map(imageToDataUrl).filter(Boolean);
  const closetImage = imageToDataUrl(object.image);
  const images = uploadedImages.length ? uploadedImages : closetImage ? [closetImage] : [];
  const owner = object.user;

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
    seller: owner ? {
      id: owner._id,
      name: `${owner.firstName} ${owner.lastName}`.trim(),
      avatar: imageToDataUrl(owner.profileImage)
    } : null
  };
}

type MarketplaceCategory = Exclude<ImageCheckResult["category"], "None">;

async function detectMarketplaceCategory(files: Express.Multer.File[]) {
  const checks = await Promise.all(files.map(checkWardrobeImage));
  const unclearImage = checks.find(
    (check) => !check.isWardrobeItem || !check.isSingleClearItem || check.category === "None"
  );
  if (unclearImage) {
    return { category: null, message: "Please upload only clear photos of the same clothing item." };
  }

  const categories = checks.map((check) => check.category);
  const category = categories[0] as MarketplaceCategory;
  if (categories.some((detectedCategory) => detectedCategory !== category)) {
    return {
      category: null,
      message: "All photos must show the same clothing item from different angles."
    };
  }
  return { category, message: "" };
}

function categoryMismatch(res: Response, detectedCategory: string, claimedCategory: string) {
  res.status(400).json({
    success: false,
    code: "CATEGORY_MISMATCH",
    detectedCategory,
    message: `The photos look like ${detectedCategory}, not ${claimedCategory}. Please check and change the category.`
  });
}

export async function getMarketplaceItems(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await Item.find({
      availabilityStatus: "active",
      listingType: { $in: ["sale", "rent"] }
    }).populate("user", "firstName lastName profileImage").sort({ createdAt: -1 });
    res.json({ success: true, items: items.map(formatMarketplaceItem) });
  } catch (error) {
    next(error);
  }
}

export async function getMyMarketplaceItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await Item.find({
      user: req.userId,
      listingType: { $in: ["sale", "rent"] }
    }).populate("user", "firstName lastName profileImage").sort({ createdAt: -1 });
    res.json({ success: true, items: items.map(formatMarketplaceItem) });
  } catch (error) {
    next(error);
  }
}

export async function getMarketplaceSeller(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sellerUserId = String(req.params.userId);
    const [currentUserBlockedSeller, sellerBlockedCurrentUser] = await Promise.all([
      User.exists({ _id: req.userId, blockedUsers: sellerUserId }),
      User.exists({ _id: sellerUserId, blockedUsers: req.userId })
    ]);
    if (currentUserBlockedSeller || sellerBlockedCurrentUser) {
      res.status(403).json({
        success: false,
        code: currentUserBlockedSeller ? "CURRENT_USER_BLOCKED_SELLER" : "SELLER_BLOCKED_CURRENT_USER",
        message: currentUserBlockedSeller ? "You blocked this account" : "This account is unavailable"
      });
      return;
    }

    const seller = await User.findById(sellerUserId)
      .select("firstName lastName profileImage publicBio");
    if (!seller) {
      res.status(404).json({ success: false, message: "Seller not found" });
      return;
    }
    const items = await Item.find({
      user: seller._id,
      availabilityStatus: "active",
      listingType: { $in: ["sale", "rent"] }
    }).populate("user", "firstName lastName profileImage").sort({ createdAt: -1 });

    res.json({
      success: true,
      seller: {
        id: seller._id,
        name: `${seller.firstName} ${seller.lastName}`.trim(),
        avatar: imageToDataUrl(seller.profileImage),
        bio: seller.publicBio || "",
        activeListingCount: items.length
      },
      items: items.map(formatMarketplaceItem)
    });
  } catch (error) {
    next(error);
  }
}

export async function getMarketplaceItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      listingType: { $in: ["sale", "rent"] },
      $or: [{ availabilityStatus: "active" }, { user: req.userId }]
    }).populate("user", "firstName lastName profileImage");
    if (!item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }
    res.json({ success: true, item: formatMarketplaceItem(item) });
  } catch (error) {
    next(error);
  }
}

export async function createMarketplaceItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const files = (req.files || []) as Express.Multer.File[];
    if (!files.length) {
      res.status(400).json({ success: false, message: "Add at least one item image" });
      return;
    }
    const detection = await detectMarketplaceCategory(files);
    if (!detection.category) {
      res.status(400).json({ success: false, message: detection.message });
      return;
    }
    if (detection.category !== req.body.category) {
      categoryMismatch(res, detection.category, req.body.category);
      return;
    }

    const images = files.map((file) => ({ data: file.buffer, contentType: file.mimetype }));
    const value = req.body;
    const item = await Item.create({
      user: req.userId,
      name: value.name,
      category: value.category,
      color: "Not specified",
      season: "All Season",
      style: "Casual",
      image: images[0],
      listingType: value.listingType,
      price: value.listingType === "sale" ? value.price : null,
      rentalPricePerDay: value.listingType === "rent" ? value.rentalPricePerDay : null,
      size: value.size,
      condition: value.condition,
      brand: value.brand,
      description: value.description,
      marketplaceImages: images,
      availabilityStatus: "active"
    });
    await item.populate("user", "firstName lastName profileImage");
    res.status(201).json({
      success: true,
      message: "Listing published successfully",
      item: formatMarketplaceItem(item)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMarketplaceItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: { $in: ["sale", "rent"] }
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }
    const files = (req.files || []) as Express.Multer.File[];
    if (!files.length && !item.image?.data && !item.marketplaceImages.length) {
      res.status(400).json({ success: false, message: "A marketplace item needs at least one image" });
      return;
    }
    const detection = files.length ? await detectMarketplaceCategory(files) : null;
    if (detection && !detection.category) {
      res.status(400).json({ success: false, message: detection.message });
      return;
    }
    if (detection?.category && detection.category !== req.body.category) {
      categoryMismatch(res, detection.category, req.body.category);
      return;
    }

    const value = req.body;
    item.set({
      ...value,
      price: value.listingType === "sale" ? value.price : null,
      rentalPricePerDay: value.listingType === "rent" ? value.rentalPricePerDay : null
    });
    if (files.length) {
      item.set("marketplaceImages", files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype
      })));
    }
    await item.save();
    await item.populate("user", "firstName lastName profileImage");
    res.json({
      success: true,
      message: "Marketplace listing updated successfully",
      item: formatMarketplaceItem(item)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMarketplaceAvailability(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, listingType: { $in: ["sale", "rent"] } },
      { availabilityStatus: req.body.availabilityStatus },
      { returnDocument: "after", runValidators: true }
    ).populate("user", "firstName lastName profileImage");
    if (!item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }
    res.json({
      success: true,
      message: req.body.availabilityStatus === "active"
        ? "Listing is available again"
        : "Listing marked as unavailable",
      item: formatMarketplaceItem(item)
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMarketplaceItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.userId,
      listingType: { $in: ["sale", "rent"] }
    });
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }
    item.availabilityStatus = "hidden";
    await item.save();
    res.json({
      success: true,
      message: "Listing removed from the marketplace"
    });
  } catch (error) {
    next(error);
  }
}
