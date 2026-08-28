import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.ts";
import itemRoutes from "./routes/itemRoutes.ts";
import outfitRoutes from "./routes/outfitRoutes.ts";
import paypalRoutes from "./routes/paypalRoutes.ts";
import marketplaceRoutes from "./routes/marketplaceRoutes.ts";
import marketplaceFavoriteRoutes from "./routes/marketplaceFavoriteRoutes.ts";
import messageRoutes from "./routes/messageRoutes.ts";
import restyleProjectRoutes from "./routes/restyleProjectRoutes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { getAllowedOrigins } from "./services/socketService.ts";

const app = express();

app.use(helmet());
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(express.json({ limit: "7mb" }));
app.use(express.urlencoded({ extended: true, limit: "7mb" }));

app.get("/", (req, res) => {
  res.send("ReStyle API is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/marketplace-favorites", marketplaceFavoriteRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/restyle-projects", restyleProjectRoutes);

app.use(errorHandler);

export default app;
