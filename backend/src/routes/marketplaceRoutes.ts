import express from "express";
import Joi from "joi";
import multer from "multer";
import mongoose from "mongoose";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";
import User from "../models/User.ts";
import { checkWardrobeImage } from "../services/wardrobeImageService.ts";
import type { ImageCheckResult } from "../services/wardrobeImageService.ts";

const router = express.Router();
const categories = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Jackets",
  "Shoes",
  "Bags",
  "Accessories"
] as const;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new Error("Marketplace images must be JPG, PNG or WEBP"));
      return;
    }

    callback(null, true);
  }
});

const marketplaceItemSchema = Joi.object({
  listingType: Joi.string().valid("sale", "rent").required(),
  price: Joi.number().positive().allow(null),
  rentalPricePerDay: Joi.number().positive().allow(null),
  size: Joi.string().trim().min(1).max(30).required(),
  condition: Joi.string()
    .valid("New", "Like New", "Excellent", "Good", "Fair")
    .required(),
  category: Joi.string().valid(...categories).required(),
  brand: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().trim().min(10).max(1000).required(),
  availabilityStatus: Joi.string()
    .valid("active", "reserved", "sold", "rented", "hidden")
    .default("active")
}).custom((value, helpers) => {
  if (value.listingType === "sale" && value.price == null) {
    return helpers.error("any.custom", {
      message: "Price is required for an item offered for sale"
    });
  }

  if (value.listingType === "rent" && value.rentalPricePerDay == null) {
    return helpers.error("any.custom", {
      message: "Rental price per day is required for an item offered for rent"
    });
  }

  return value;
});

const createMarketplaceItemSchema = marketplaceItemSchema.append({
  name: Joi.string().trim().min(2).max(80).required()
});
const availabilitySchema = Joi.object({
  availabilityStatus: Joi.string().valid("active", "hidden").required()
});

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

async function detectMarketplaceCategory(
  files: Express.Multer.File[]
): Promise<{ category: MarketplaceCategory | null; message: string }> {
  const checks = await Promise.all(files.map(checkWardrobeImage));
  const unclearImage = checks.find(
    (check) => !check.isWardrobeItem || !check.isSingleClearItem || check.category === "None"
  );

  if (unclearImage) {
    return {
      category: null,
      message: "Please upload only clear photos of the same clothing item."
    };
  }

  const detectedCategories = checks.map((check) => check.category);
  const category = detectedCategories[0] as MarketplaceCategory;
  if (detectedCategories.some((detectedCategory) => detectedCategory !== category)) {
    return {
      category: null,
      message: "All photos must show the same clothing item from different angles."
    };
  }

  return { category, message: "" };
}

router.use(authenticateToken);

router.get("/", async (_req: AuthRequest, res, next) => {
  try {
    const items = await Item.find({
      availabilityStatus: "active",
      listingType: { $in: ["sale", "rent"] }
    })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      items: items.map(formatMarketplaceItem)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mine", async (req: AuthRequest, res, next) => {
  try {
    const items = await Item.find({
      user: req.userId,
      listingType: { $in: ["sale", "rent"] }
    })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 });

    res.json({ success: true, items: items.map(formatMarketplaceItem) });
  } catch (error) {
    next(error);
  }
});

router.get("/sellers/:userId", async (req: AuthRequest, res, next) => {
  try {
    const sellerUserId = String(req.params.userId);

    if (!mongoose.isValidObjectId(sellerUserId)) {
      res.status(404).json({ success: false, message: "Seller not found" });
      return;
    }

    const [currentUserBlockedSeller, sellerBlockedCurrentUser] = await Promise.all([
      User.exists({ _id: req.userId, blockedUsers: sellerUserId }),
      User.exists({ _id: sellerUserId, blockedUsers: req.userId })
    ]);

    if (currentUserBlockedSeller || sellerBlockedCurrentUser) {
      res.status(403).json({
        success: false,
        code: currentUserBlockedSeller
          ? "CURRENT_USER_BLOCKED_SELLER"
          : "SELLER_BLOCKED_CURRENT_USER",
        message: currentUserBlockedSeller
          ? "You blocked this account"
          : "This account is unavailable"
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
    })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 });

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
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }

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
});

router.post(
  "/",
  upload.array("images", 4),
  async (req: AuthRequest, res, next) => {
    try {
      const normalizedBody = {
        ...req.body,
        price: req.body.price === "" || req.body.price === undefined
          ? null
          : req.body.price,
        rentalPricePerDay:
          req.body.rentalPricePerDay === "" ||
          req.body.rentalPricePerDay === undefined
            ? null
            : req.body.rentalPricePerDay
      };
      const { error, value } = createMarketplaceItemSchema.validate(
        normalizedBody,
        { abortEarly: false, stripUnknown: true }
      );

      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0]?.context?.message || error.details[0]?.message,
          errors: error.details.map((detail) => detail.message)
        });
        return;
      }

      const files = (req.files || []) as Express.Multer.File[];

      if (files.length === 0) {
        res.status(400).json({
          success: false,
          message: "Add at least one item image"
        });
        return;
      }

      const imageDetection = await detectMarketplaceCategory(files);
      if (!imageDetection.category) {
        res.status(400).json({ success: false, message: imageDetection.message });
        return;
      }
      if (imageDetection.category !== value.category) {
        res.status(400).json({
          success: false,
          code: "CATEGORY_MISMATCH",
          detectedCategory: imageDetection.category,
          message: `The photos look like ${imageDetection.category}, not ${value.category}. Please check and change the category.`
        });
        return;
      }

      const images = files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype
      }));
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
        rentalPricePerDay:
          value.listingType === "rent" ? value.rentalPricePerDay : null,
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
);

router.put(
  "/:id",
  upload.array("images", 4),
  async (req: AuthRequest, res, next) => {
    try {
      const normalizedBody = {
        ...req.body,
        price: req.body.price === "" || req.body.price === undefined
          ? null
          : req.body.price,
        rentalPricePerDay:
          req.body.rentalPricePerDay === "" ||
          req.body.rentalPricePerDay === undefined
            ? null
            : req.body.rentalPricePerDay
      };
      const { error, value } = marketplaceItemSchema.validate(normalizedBody, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0]?.context?.message || error.details[0]?.message,
          errors: error.details.map((detail) => detail.message)
        });
        return;
      }

      const item = await Item.findOne({ _id: req.params.id, user: req.userId });

      if (!item) {
        res.status(404).json({ success: false, message: "Item not found" });
        return;
      }

      const files = (req.files || []) as Express.Multer.File[];

      if (files.length === 0 && !item.image?.data && item.marketplaceImages.length === 0) {
        res.status(400).json({
          success: false,
          message: "A marketplace item needs at least one image"
        });
        return;
      }

      const imageDetection = files.length > 0
        ? await detectMarketplaceCategory(files)
        : null;
      if (imageDetection && !imageDetection.category) {
        res.status(400).json({ success: false, message: imageDetection.message });
        return;
      }
      if (imageDetection?.category && imageDetection.category !== value.category) {
        res.status(400).json({
          success: false,
          code: "CATEGORY_MISMATCH",
          detectedCategory: imageDetection.category,
          message: `The photos look like ${imageDetection.category}, not ${value.category}. Please check and change the category.`
        });
        return;
      }

      item.set({
        ...value,
        category: value.category,
        price: value.listingType === "sale" ? value.price : null,
        rentalPricePerDay:
          value.listingType === "rent" ? value.rentalPricePerDay : null
      });

      if (files.length > 0) {
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
);

router.patch("/:id/availability", async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = availabilitySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0]?.message,
        errors: error.details.map((detail) => detail.message)
      });
      return;
    }

    const item = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
        listingType: { $in: ["sale", "rent"] }
      },
      { availabilityStatus: value.availabilityStatus },
      { returnDocument: "after", runValidators: true }
    ).populate("user", "firstName lastName profileImage");

    if (!item) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }

    res.json({
      success: true,
      message: value.availabilityStatus === "active"
        ? "Listing is available again"
        : "Listing marked as unavailable",
      item: formatMarketplaceItem(item)
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
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

    item.listingType = null;
    item.price = null;
    item.rentalPricePerDay = null;
    item.availabilityStatus = "hidden";
    await item.save();

    res.json({
      success: true,
      message: "Item removed from the marketplace. It is still in My Closet."
    });
  } catch (error) {
    next(error);
  }
});

export default router;
