import express from "express";
import Joi from "joi";
import multer from "multer";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import Item from "../models/Item.ts";

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
  price: Joi.number().min(0).allow(null),
  rentalPricePerDay: Joi.number().min(0).allow(null),
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

      item.set({
        ...value,
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

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, user: req.userId });

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
