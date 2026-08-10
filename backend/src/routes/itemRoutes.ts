import express from "express";
import multer from "multer";

import Item from "../models/Item.ts";
import User from "../models/User.ts";

const router = express.Router();

// ================================
// MULTER
// ================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// ================================
// ADD ITEM
// ================================

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      email,
      name,
      category,
      color,
      season,
      style,
      favorite
    } = req.body;

    if (!email || !name || !category || !color || !season || !style) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const newItem = await Item.create({
      user: user._id,
      name: name.trim(),
      category,
      color: color.trim(),
      season,
      style,

      favorite:
        favorite === "true" ||
        favorite === true,

      image: req.file
        ? {
            data: req.file.buffer,
            contentType: req.file.mimetype
          }
        : undefined
    });

    return res.status(201).json({
      success: true,
      message: "Item added successfully",
      item: newItem
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

// ================================
// GET USER ITEMS
// ================================

router.get("/", async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const items = await Item.find({
      user: user._id
    }).sort({ createdAt: -1 });

    const formattedItems = items.map(item => {
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

    return res.status(200).json({
      success: true,
      items: formattedItems
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

// ================================
// UPDATE FAVORITE
// ================================

router.put("/:id/favorite", async (req, res) => {
  try {
    const { email, favorite } = req.body;
    const { id } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const item = await Item.findOne({
      _id: id,
      user: user._id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    item.favorite = Boolean(favorite);

    await item.save();

    return res.status(200).json({
      success: true,
      message: "Favorite updated successfully",
      item
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

// ================================
// UPDATE ITEM
// ================================

router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;

    const {
      email,
      name,
      category,
      color,
      season,
      style
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const item = await Item.findOne({
      _id: id,
      user: user._id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    if (name !== undefined) {
      item.name = name.trim();
    }

    if (category !== undefined) {
      item.category = category;
    }

    if (color !== undefined) {
      item.color = color.trim();
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

    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
      item
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

// ================================
// DELETE ITEM
// ================================

router.delete("/:id", async (req, res) => {
  try {
    const email = req.query.email as string;
    const { id } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const deletedItem = await Item.findOneAndDelete({
      _id: id,
      user: user._id
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item deleted successfully"
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
});

export default router;