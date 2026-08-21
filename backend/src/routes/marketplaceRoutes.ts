import express from "express";
import Joi from "joi";
import multer from "multer";

import { authenticateToken, type AuthRequest } from "../middleware/auth.ts";
import MarketplaceListing from "../models/MarketplaceListing.ts";

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
const listingStatuses = ["Active", "Reserved", "Sold", "Rented", "Hidden"] as const;
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

const listingSchema = Joi.object({
  title: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().min(10).max(1000).required(),
  category: Joi.string().valid(...categories).required(),
  size: Joi.string().trim().min(1).max(30).required(),
  condition: Joi.string().valid("New", "Like New", "Good", "Fair").required(),
  listingType: Joi.string().valid("Sale", "Rent", "Sale or Rent").required(),
  salePrice: Joi.number().min(0).allow(null),
  rentalPricePerDay: Joi.number().min(0).allow(null),
  location: Joi.string().trim().min(2).max(100).required(),
  contactMethod: Joi.string().valid("Email", "Phone", "WhatsApp").required(),
  contactValue: Joi.string().trim().min(5).max(120).required(),
  status: Joi.string().valid(...listingStatuses).default("Active")
}).custom((value, helpers) => {
  if (["Sale", "Sale or Rent"].includes(value.listingType) && value.salePrice == null) {
    return helpers.error("any.custom", { message: "Sale price is required" });
  }

  if (["Rent", "Sale or Rent"].includes(value.listingType) && value.rentalPricePerDay == null) {
    return helpers.error("any.custom", { message: "Rental price is required" });
  }

  return value;
});

function parseListing(body: Record<string, unknown>, isUpdate = false) {
  const normalized = { ...body };

  if (!isUpdate || body.salePrice !== undefined) {
    normalized.salePrice = body.salePrice === "" ? null : body.salePrice;
  }

  if (!isUpdate || body.rentalPricePerDay !== undefined) {
    normalized.rentalPricePerDay =
      body.rentalPricePerDay === "" ? null : body.rentalPricePerDay;
  }
  const schema = isUpdate ? listingSchema.fork(
    [
      "title",
      "description",
      "category",
      "size",
      "condition",
      "listingType",
      "location",
      "contactMethod",
      "contactValue"
    ],
    (field) => field.optional()
  ) : listingSchema;

  return schema.validate(normalized, {
    abortEarly: false,
    stripUnknown: true
  });
}

function formatListing(listing: any) {
  const object = listing.toObject ? listing.toObject() : listing;

  return {
    ...object,
    images: (object.images || []).map((image: any) =>
      `data:${image.contentType};base64,${image.data.toString("base64")}`
    )
  };
}

router.use(authenticateToken);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const filter: Record<string, unknown> = { status: "Active" };

    if (req.query.category && categories.includes(req.query.category as any)) {
      filter.category = req.query.category;
    }

    if (req.query.listingType) {
      filter.listingType = req.query.listingType;
    }

    const listings = await MarketplaceListing.find(filter)
      .populate("seller", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      listings: listings.map(formatListing)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mine", async (req: AuthRequest, res, next) => {
  try {
    const listings = await MarketplaceListing.find({ seller: req.userId })
      .populate("seller", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({ success: true, listings: listings.map(formatListing) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id)
      .populate("seller", "firstName lastName");

    if (!listing || (listing.status === "Hidden" && listing.seller._id.toString() !== req.userId)) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }

    res.json({ success: true, listing: formatListing(listing) });
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.array("images", 4), async (req: AuthRequest, res, next) => {
  try {
    const files = (req.files || []) as Express.Multer.File[];
    const { error, value } = parseListing(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0]?.context?.message || error.details[0]?.message,
        errors: error.details.map((detail) => detail.message)
      });
      return;
    }

    if (files.length === 0) {
      res.status(400).json({ success: false, message: "Add at least one item image" });
      return;
    }

    const listing = await MarketplaceListing.create({
      ...value,
      seller: req.userId,
      images: files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype
      }))
    });

    await listing.populate("seller", "firstName lastName");
    res.status(201).json({
      success: true,
      message: "Listing published successfully",
      listing: formatListing(listing)
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", upload.array("images", 4), async (req: AuthRequest, res, next) => {
  try {
    const listing = await MarketplaceListing.findOne({
      _id: req.params.id,
      seller: req.userId
    });

    if (!listing) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }

    const { error, value } = parseListing(req.body, true);

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0]?.context?.message || error.details[0]?.message,
        errors: error.details.map((detail) => detail.message)
      });
      return;
    }

    Object.assign(listing, value);
    const files = (req.files || []) as Express.Multer.File[];

    if (files.length > 0) {
      listing.set("images", files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype
      })));
    }

    await listing.save();
    await listing.populate("seller", "firstName lastName");
    res.json({
      success: true,
      message: "Listing updated successfully",
      listing: formatListing(listing)
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const listing = await MarketplaceListing.findOneAndDelete({
      _id: req.params.id,
      seller: req.userId
    });

    if (!listing) {
      res.status(404).json({ success: false, message: "Listing not found" });
      return;
    }

    res.json({ success: true, message: "Listing deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
