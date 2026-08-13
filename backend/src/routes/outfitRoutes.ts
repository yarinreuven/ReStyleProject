import express from "express";
import Joi from "joi";

import Item from "../models/Item.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";

const router = express.Router();

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
        "Ignore an item completely if its image does not clearly show the wardrobe item described by its metadata.",
        "Create one cohesive outfit using ONLY valid item IDs whose attached images clearly show real wearable items.",
        "Never trust an item's name or category when its image contradicts them.",
        "Never invent, recommend or mention any clothing, shoes, bag or accessory that is not among the valid attached wardrobe images.",
        "A complete outfit MUST contain either: (1) one Tops item plus one Bottoms item, or (2) one Dresses item.",
        "Shoes, Bags and Accessories are optional additions and never count as the required outfit base.",
        "Select at most one top, one bottom or one dress, one pair of shoes, one bag, and suitable accessories.",
        "Return each selected item's visually detected category, based on the image rather than its claimed metadata.",
        "Consider the event, requested style, weather, categories, colors and season.",
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
      const validSelections = suggestion.selectedItems.filter((selection) =>
        allowedIds.has(selection.id)
      );

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

      if (!hasDress && !hasTopAndBottom) {
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

      const selectedItems = selectedIds.map((id) => {
        const item = items.find((candidate) => candidate._id.toString() === id)!;
        const image = item.image?.data && item.image?.contentType
          ? `data:${item.image.contentType};base64,${item.image.data.toString("base64")}`
          : "";

        return {
          _id: item._id,
          name: item.name,
          category: item.category,
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

export default router;
