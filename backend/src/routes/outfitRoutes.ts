import express from "express";
import Joi from "joi";
import multer from "multer";

import Item from "../models/Item.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";
import { createCatVtonImage } from "../services/catVtonService.ts";
import { createGeminiTryOnImage } from "../services/geminiTryOnService.ts";
import { createOpenAiTryOnImage } from "../services/openAiTryOnService.ts";

const router = express.Router();
const tryOnUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(new Error("The virtual model must be a JPG, PNG or WEBP image"));
      return;
    }

    callback(null, true);
  }
});

router.use(authenticateToken);

const outfitRequestSchema = Joi.object({
  event: Joi.string().trim().min(2).max(250).required(),
  style: Joi.string()
    .valid("Casual", "Classic", "Elegant", "Sporty", "Streetwear")
    .required(),
  weather: Joi.string()
    .valid("Warm", "Mild", "Cold", "Rainy")
    .required(),
  preferFavorites: Joi.boolean().required()
});

interface GeminiResponse {
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

interface OutfitSuggestion {
  title: string;
  explanation: string;
  selectedItems: Array<{
    id: string;
    detectedCategory: "Tops" | "Bottoms" | "Dresses" | "Shoes" | "Bags" | "Accessories";
  }>;
  stylingTips: string[];
}

router.post(
  "/generate",
  async (req: AuthRequest, res, next) => {
    try {
      const { error, value } = outfitRequestSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0].message
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        res.status(503).json({
          success: false,
          message: "The AI service is not configured yet"
        });
        return;
      }

      const items = await Item.find({ user: req.userId }).select(
        "name category color season style favorite wearCount lastWornAt image"
      );

      if (items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Add at least one item to your closet before creating a look"
        });
        return;
      }

      const wardrobe = items.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        season: item.season,
        style: item.style,
        favorite: item.favorite,
        wearCount: item.wearCount
      }));

      const prompt = [
        "You are ReStyle, a personal fashion stylist.",
        "First inspect every attached image yourself.",
        "Ignore an item completely unless its image shows exactly one clear, dominant clothing product with its full shape and design visible.",
        "Reject closet scenes, clothing racks, piles, collages, people wearing clothes, full outfits with several garments, and images where the item is distant, cropped or unclear.",
        "Create one cohesive outfit using ONLY valid item IDs whose attached images clearly show real wearable items.",
        "Never trust an item's name or category when its image contradicts them.",
        "Never invent, recommend or mention any clothing, shoes, bag or accessory that is not among the valid attached wardrobe images.",
        "A complete outfit MUST contain exactly one of these two bases: (1) one Tops item plus one Bottoms item, or (2) one Dresses item. Never combine a dress with a top or bottom.",
        "Shoes, Bags and Accessories never count as the required outfit base.",
        "If at least one valid Shoes item exists, the completed outfit MUST include exactly one suitable pair of shoes.",
        "Include one suitable bag whenever the valid wardrobe contains a bag that fits the request. Include one suitable accessory whenever available and relevant.",
        "Select exactly one top and one bottom OR exactly one dress, plus at most one pair of shoes, one bag and one accessory.",
        "Return each selected item's visually detected category, based on the image rather than its claimed metadata.",
        "The requested event is a HARD constraint, not a suggestion. The outfit must be genuinely appropriate for that event.",
        "For Work choose polished, professional and practical pieces. For Party choose festive, expressive evening-appropriate pieces. For Formal choose refined dressy pieces. For Date choose stylish occasion-appropriate pieces. For Casual choose relaxed everyday pieces. For a custom event infer its real dress code from the user's description.",
        "After satisfying the event, match the requested style and weather, then coordinate categories, colors and season.",
        "Do not select a piece merely because it exists. If the wardrobe has no complete outfit that fits the event, return an empty selectedItems array.",
        "Prefer favorites only when the request says preferFavorites is true.",
        "If a complete outfit base cannot be made, return an empty selectedItems array. Do not return a partial outfit.",
        "Every styling tip must refer only to a selected or available valid wardrobe item. Do not suggest buying or adding anything.",
        "If no attached image shows a valid wardrobe item, return an empty selectedItems array.",
        "Keep the explanation concise and encouraging.",
        JSON.stringify({ request: value, wardrobe })
      ].join("\n");

      const imageParts = items.flatMap((item) => {
        if (!item.image?.data || !item.image?.contentType) {
          return [];
        }

        return [
          {
            text: `The next image belongs to item ID ${item._id.toString()} (${item.name}, claimed category: ${item.category}).`
          },
          {
            inline_data: {
              mime_type: item.image.contentType,
              data: item.image.data.toString("base64")
            }
          }
        ];
      });

      const aiResponse = await fetch(
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
                { text: prompt },
                ...imageParts
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                explanation: { type: "STRING" },
                selectedItems: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      detectedCategory: {
                        type: "STRING",
                        enum: [
                          "Tops",
                          "Bottoms",
                          "Dresses",
                          "Shoes",
                          "Bags",
                          "Accessories"
                        ]
                      }
                    },
                    required: ["id", "detectedCategory"]
                  }
                },
                stylingTips: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  minItems: 1,
                  maxItems: 3
                }
              },
              required: [
                "title",
                "explanation",
                "selectedItems",
                "stylingTips"
              ]
            }
          }
        })
      });

      const aiData = await aiResponse.json() as GeminiResponse;

      if (!aiResponse.ok) {
        console.error("Gemini API error:", aiData.error?.message);
        res.status(502).json({
          success: false,
          message: "The AI stylist could not create a look right now"
        });
        return;
      }

      const outputText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!outputText) {
        throw new Error("The Gemini response did not include output text");
      }

      const suggestion = JSON.parse(outputText) as OutfitSuggestion;
      const allowedIds = new Set(items.map((item) => item._id.toString()));
      const uniqueCategories = new Set<string>();
      const uniqueIds = new Set<string>();
      let validSelections = suggestion.selectedItems.filter((selection) => {
        if (
          !allowedIds.has(selection.id) ||
          uniqueIds.has(selection.id) ||
          uniqueCategories.has(selection.detectedCategory)
        ) {
          return false;
        }

        uniqueIds.add(selection.id);
        uniqueCategories.add(selection.detectedCategory);
        return true;
      });

      const suggestedCategories = new Set(
        validSelections.map((selection) => selection.detectedCategory)
      );

      if (suggestedCategories.has("Dresses")) {
        validSelections = validSelections.filter((selection) =>
          !["Tops", "Bottoms"].includes(selection.detectedCategory)
        );
      }

      const selectedIds = validSelections.map((selection) => selection.id);

      if (selectedIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "There are not enough valid items to build a complete outfit. Add a top and a bottom, or add a dress."
        });
        return;
      }

      const detectedCategories = new Set(
        validSelections.map((selection) => selection.detectedCategory)
      );
      const hasDress = detectedCategories.has("Dresses");
      const hasTopAndBottom =
        detectedCategories.has("Tops") &&
        detectedCategories.has("Bottoms");
      const mixesDressWithSeparates =
        hasDress &&
        (detectedCategories.has("Tops") || detectedCategories.has("Bottoms"));

      if ((!hasDress && !hasTopAndBottom) || mixesDressWithSeparates) {
        const missingPieces: string[] = [];

        if (!detectedCategories.has("Tops")) {
          missingPieces.push("a top");
        }

        if (!detectedCategories.has("Bottoms")) {
          missingPieces.push("a bottom");
        }

        res.status(400).json({
          success: false,
          message:
            `A complete outfit needs a dress, or a top and a bottom. Missing ${missingPieces.join(" and ")}.`
        });
        return;
      }

      const wardrobeHasShoes = items.some((item) =>
        item.category === "Shoes" && item.image?.data
      );

      if (wardrobeHasShoes && !detectedCategories.has("Shoes")) {
        res.status(400).json({
          success: false,
          message: "The AI could not create a complete look with suitable shoes from your wardrobe. Try a different request or add matching shoes."
        });
        return;
      }

      const selectedItems = selectedIds.map((id) => {
        const item = items.find((candidate) => candidate._id.toString() === id)!;
        const image = item.image?.data && item.image?.contentType
          ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
          : "";

        return {
          _id: item._id,
          name: item.name,
          category: item.category,
          detectedCategory: validSelections.find((selection) =>
            selection.id === id
          )?.detectedCategory,
          color: item.color,
          image
        };
      });

      res.json({
        success: true,
        outfit: {
          title: suggestion.title,
          explanation: suggestion.explanation,
          stylingTips: suggestion.stylingTips,
          items: selectedItems
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/try-on",
  tryOnUpload.single("modelImage"),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({
          success: false,
          message: "Choose an illustrated avatar or upload a full-body photo"
        });
        return;
      }

      let itemIds: unknown;

      try {
        itemIds = JSON.parse(req.body.itemIds || "[]");
      } catch {
        itemIds = [];
      }

      if (
        !Array.isArray(itemIds) ||
        itemIds.length === 0 ||
        itemIds.length > 6 ||
        new Set(itemIds).size !== itemIds.length ||
        itemIds.some((id) =>
          typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)
        )
      ) {
        res.status(400).json({
          success: false,
          message: "The selected outfit is not valid"
        });
        return;
      }

      const items = await Item.find({
        _id: { $in: itemIds },
        user: req.userId
      }).select("name category image");

      const itemById = new Map(
        items.map((item) => [item._id.toString(), item])
      );
      const orderedItems = itemIds
        .map((id) => itemById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (orderedItems.length !== itemIds.length) {
        res.status(400).json({
          success: false,
          message: "One or more selected items no longer exist in your wardrobe"
        });
        return;
      }

      const top = orderedItems.find((item) => item.category === "Tops");
      const bottom = orderedItems.find((item) => item.category === "Bottoms");
      const dress = orderedItems.find((item) => item.category === "Dresses");

      if (!dress && (!top || !bottom)) {
        res.status(400).json({
          success: false,
          message: "A try-on needs a dress, or both a top and a bottom"
        });
        return;
      }

      const missingImage = orderedItems.find((item) =>
        !item.image?.data || !item.image?.contentType
      );

      if (missingImage) {
        res.status(400).json({
          success: false,
          message: `The item "${missingImage.name}" needs an image for virtual try-on`
        });
        return;
      }

      const tryOnInputs = orderedItems.map((item) => ({
        name: item.name,
        category: item.category,
        data: item.image!.data,
        contentType: item.image!.contentType
      }));
      let openAiFailure = "";

      try {
        const generated = await createOpenAiTryOnImage(
          req.file.buffer,
          req.file.mimetype,
          tryOnInputs
        );

        res.json({
          success: true,
          renderer: "openai",
          tryOnImage: `data:${generated.contentType};base64,${generated.data.toString("base64")}`
        });
        return;
      } catch (openAiError) {
        openAiFailure = openAiError instanceof Error
          ? openAiError.message
          : "Unknown OpenAI image error";
        console.error("OpenAI try-on error; falling back to Gemini:", openAiError);
      }

      try {
        const generated = await createGeminiTryOnImage(
          req.file.buffer,
          req.file.mimetype,
          tryOnInputs
        );

        res.json({
          success: true,
          renderer: "gemini",
          tryOnImage: `data:${generated.contentType};base64,${generated.data.toString("base64")}`
        });
        return;
      } catch (geminiError) {
        console.error("Gemini try-on error; falling back to CatVTON:", geminiError);
      }

      const fullLookExtras = orderedItems.filter((item) =>
        ["Shoes", "Bags", "Accessories"].includes(item.category)
      );

      if (fullLookExtras.length > 0) {
        const needsOpenAiBilling = /billing|quota|credit|limit/i.test(openAiFailure);

        res.status(502).json({
          success: false,
          message: needsOpenAiBilling
            ? "The full outfit renderer needs available OpenAI API billing or credits to dress the avatar in the selected clothes, shoes and bag."
            : "The full outfit renderer is unavailable right now. A partial image without the selected shoes or bag will not be shown."
        });
        return;
      }

      const garments = dress
        ? [{ item: dress, type: "overall" as const }]
        : [
            { item: bottom!, type: "lower" as const },
            { item: top!, type: "upper" as const }
          ];

      let currentImage = req.file.buffer;
      let currentContentType = req.file.mimetype;

      try {
        for (const garment of garments) {
          const result = await createCatVtonImage(
            currentImage,
            garment.item.image!.data,
            garment.type
          );

          currentImage = result.data;
          currentContentType = result.contentType;
        }

        res.json({
          success: true,
          renderer: "catvton-fallback",
          tryOnImage: `data:${currentContentType};base64,${currentImage.toString("base64")}`
        });
        return;
      } catch (catVtonError) {
        console.error("CatVTON try-on error:", catVtonError);
        const needsOpenAiBilling = /billing|quota|credit|limit/i.test(openAiFailure);

        res.status(502).json({
          success: false,
          message: needsOpenAiBilling
            ? "Virtual try-on needs available OpenAI API billing or credits. The other fitting services are currently at their quota."
            : "The virtual try-on services could not create the fitted image right now. Please try again shortly."
        });
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";

      console.error(
        "CatVTON error:",
        errorMessage || error
      );

      res.status(502).json({
        success: false,
        message: errorMessage.includes("NSFW safety placeholder")
          ? "The virtual fitting service incorrectly blocked this image. Please try again with the safe illustrated model or a clear, fully clothed photo."
          : "The free virtual try-on is busy or its daily quota has ended. Please try again later."
      });
    }
  }
);

export default router;
