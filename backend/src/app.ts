import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.ts";
import itemRoutes from "./routes/itemRoutes.ts";
import outfitRoutes from "./routes/outfitRoutes.ts";
import marketplaceRoutes from "./routes/marketplaceRoutes.ts";
import messageRoutes from "./routes/messageRoutes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReStyle API is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/messages", messageRoutes);

app.use(errorHandler);

export default app;
