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

const clothingCategories = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Shoes",
  "Bags",
  "Accessories"
] as const;

interface GeminiImageCheckResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ImageCheckResult {
  isWardrobeItem: boolean;
  category: typeof clothingCategories[number] | "None";
}

async function checkWardrobeImage(
  file: Express.Multer.File
): Promise<ImageCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Inspect this image. Accept it only when its main subject is a clearly visible wearable wardrobe item: top, bottom, dress, shoes, bag or fashion accessory. Reject unrelated objects, rooms, people without a clearly identifiable item, screenshots, drawings that do not show a usable item, and images where the item cannot be identified. Return the single best category."
              },
              {
                inline_data: {
                  mime_type: file.mimetype,
                  data: file.buffer.toString("base64")
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              isWardrobeItem: { type: "BOOLEAN" },
              category: {
                type: "STRING",
                enum: [...clothingCategories, "None"]
              }
            },
            required: ["isWardrobeItem", "category"]
          }
        }
      })
    }
  );

  const data = await response.json() as GeminiImageCheckResponse;

  if (!response.ok) {
    console.error("Gemini image check error:", data.error?.message);
    throw new Error("The image could not be checked right now");
  }

  const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!outputText) {
    throw new Error("The image check returned no result");
  }

  return JSON.parse(outputText) as ImageCheckResult;
}

async function validateWardrobeImage(
  file: Express.Multer.File,
  selectedCategory: string
) {
  const imageCheck = await checkWardrobeImage(file);

  if (!imageCheck.isWardrobeItem || imageCheck.category === "None") {
    return {
      valid: false,
      message: "This image does not appear to show a clothing or wardrobe item"
    };
  }

  if (imageCheck.category !== selectedCategory) {
    return {
      valid: false,
      message: `This image looks like ${imageCheck.category}. Please choose the matching category.`
    };
  }

  return { valid: true, message: "" };
}

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

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Please upload an image of the item"
        });
        return;
      }

      const imageValidation = await validateWardrobeImage(
        req.file,
        category
      );

      if (!imageValidation.valid) {
        res.status(400).json({
          success: false,
          message: imageValidation.message
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

        image: {
          data: req.file.buffer,
          contentType: req.file.mimetype
        }
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
          wornDates:
            itemObject.wornDates?.length > 0
              ? itemObject.wornDates
              : itemObject.lastWornAt
                ? [itemObject.lastWornAt]
                : [],
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
// MARK ITEM AS WORN
// ================================

router.put(
  "/:id/worn",
  async (req: AuthRequest, res, next) => {
    try {
      const selectedDate = req.body.date
        ? new Date(`${req.body.date}T12:00:00`)
        : new Date();

      if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.getTime() > Date.now()
      ) {
        res.status(400).json({
          success: false,
          message: "Please choose a valid date that is not in the future"
        });
        return;
      }

      const item = await Item.findOne({
        _id: req.params.id,
        user: req.userId
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: "Item not found"
        });
        return;
      }

      const dateKey = selectedDate.toISOString().slice(0, 10);
      const wornDates = (item.wornDates || []).map(
        (date) => new Date(date as unknown as string)
      );
      if (wornDates.length === 0 && item.lastWornAt) {
        wornDates.push(new Date(item.lastWornAt));
      }
      const alreadyMarked = wornDates.some(
        (date) => date.toISOString().slice(0, 10) === dateKey
      );

      if (!alreadyMarked) {
        wornDates.push(selectedDate);
        wornDates.sort(
          (first, second) => first.getTime() - second.getTime()
        );
        item.set("wornDates", wornDates);
        item.wearCount = wornDates.length;
        item.lastWornAt =
          wornDates[wornDates.length - 1] || null;
        await item.save();
      }

      res.status(200).json({
        success: true,
        message: alreadyMarked
          ? "This wear date is already recorded"
          : "Wear date added successfully",
        alreadyMarked,
        item
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/worn",
  async (req: AuthRequest, res, next) => {
    try {
      const { date } = req.body;

      if (!date) {
        res.status(400).json({
          success: false,
          message: "Wear date is required"
        });
        return;
      }

      const item = await Item.findOne({
        _id: req.params.id,
        user: req.userId
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: "Item not found"
        });
        return;
      }

      const existingWornDates = (item.wornDates || [])
        .map((wornDate) => new Date(wornDate as unknown as string));
      if (existingWornDates.length === 0 && item.lastWornAt) {
        existingWornDates.push(new Date(item.lastWornAt));
      }
      const wornDates = existingWornDates.filter(
          (wornDate) => wornDate.toISOString().slice(0, 10) !== date
        );
      item.set("wornDates", wornDates);
      item.wearCount = wornDates.length;
      item.lastWornAt =
        wornDates[wornDates.length - 1] || null;
      await item.save();

      res.status(200).json({
        success: true,
        message: "Wear date removed successfully",
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
        const imageValidation = await validateWardrobeImage(
          req.file,
          category || item.category
        );

        if (!imageValidation.valid) {
          res.status(400).json({
            success: false,
            message: imageValidation.message
          });
          return;
        }

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
