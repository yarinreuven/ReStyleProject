import express from "express";
import multer from "multer";

import Item from "../models/Item.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";

const router = express.Router();

// כל הנתיבים בקובץ דורשים משתמש מחובר
router.use(authenticateToken);

// ================================
// MULTER
// ================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new Error("Only image files are allowed"));
    }
  }
});

// ================================
// ADD ITEM
// ================================

router.post(
  "/",
  upload.single("image"),
  async (req: AuthRequest, res, next) => {
    try {
      const {
        name,
        category,
        color,
        season,
        style,
        favorite
      } = req.body;

      if (
        !name ||
        !category ||
        !color ||
        !season ||
        !style
      ) {
        res.status(400).json({
          success: false,
          message: "Please fill in all required fields"
        });
        return;
      }

      const newItem = await Item.create({
        user: req.userId,
        name: name.trim(),
        category,
        color: color.trim(),
        season,
        style,

        favorite:
          favorite === true ||
          favorite === "true",

        image: req.file
          ? {
              data: req.file.buffer,
              contentType: req.file.mimetype
            }
          : undefined
      });

      res.status(201).json({
        success: true,
        message: "Item added successfully",
        item: newItem
      });
    } catch (error) {
      next(error);
    }
  }
);

// ================================
// GET USER ITEMS
// ================================

router.get(
  "/",
  async (req: AuthRequest, res, next) => {
    try {
      const items = await Item.find({
        user: req.userId
      }).sort({ createdAt: -1 });

      const formattedItems = items.map((item) => {
        const itemObject = item.toObject();

        let image = "";

        if (
          item.image &&
          item.image.data &&
          item.image.contentType
        ) {
          image =
            `data:${item.image.contentType};base64,` +
            item.image.data.toString("base64");
        }

        return {
          ...itemObject,
          image
        };
      });

      res.status(200).json({
        success: true,
        items: formattedItems
      });
    } catch (error) {
      next(error);
    }
  }
);

// ================================
// UPDATE FAVORITE
// ================================

router.put(
  "/:id/favorite",
  async (req: AuthRequest, res, next) => {
    try {
      const { favorite } = req.body;
      const { id } = req.params;

      const item = await Item.findOne({
        _id: id,
        user: req.userId
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: "Item not found"
        });
        return;
      }

      item.favorite =
        favorite === true ||
        favorite === "true";

      await item.save();

      res.status(200).json({
        success: true,
        message: "Favorite updated successfully",
        item
      });
    } catch (error) {
      next(error);
    }
  }
);

// ================================
// UPDATE ITEM
// ================================

router.put(
  "/:id",
  upload.single("image"),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const {
        name,
        category,
        color,
        season,
        style
      } = req.body;

      const item = await Item.findOne({
        _id: id,
        user: req.userId
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: "Item not found"
        });
        return;
      }

      if (name !== undefined) {
        const trimmedName = name.trim();

        if (!trimmedName) {
          res.status(400).json({
            success: false,
            message: "Item name cannot be empty"
          });
          return;
        }

        item.name = trimmedName;
      }

      if (category !== undefined) {
        item.category = category;
      }

      if (color !== undefined) {
        const trimmedColor = color.trim();

        if (!trimmedColor) {
          res.status(400).json({
            success: false,
            message: "Color cannot be empty"
          });
          return;
        }

        item.color = trimmedColor;
      }

      if (season !== undefined) {
        item.season = season;
      }

      if (style !== undefined) {
        item.style = style;
      }

      if (req.file) {
        item.image = {
          data: req.file.buffer,
          contentType: req.file.mimetype
        };
      }

      await item.save();

      res.status(200).json({
        success: true,
        message: "Item updated successfully",
        item
      });
    } catch (error) {
      next(error);
    }
  }
);

// ================================
// DELETE ITEM
// ================================

router.delete(
  "/:id",
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const deletedItem = await Item.findOneAndDelete({
        _id: id,
        user: req.userId
      });

      if (!deletedItem) {
        res.status(404).json({
          success: false,
          message: "Item not found"
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Item deleted successfully"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;