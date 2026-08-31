import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.ts";
import itemRoutes from "./routes/itemRoutes.ts";
import outfitRoutes from "./routes/outfitRoutes.ts";
import paypalRoutes from "./routes/paypalRoutes.ts";
import marketplaceRoutes from "./routes/marketplaceRoutes.ts";
import marketplaceFavoriteRoutes from "./routes/marketplaceFavoriteRoutes.ts";
import messageRoutes from "./routes/messageRoutes.ts";
import restyleProjectRoutes from "./routes/restyleProjectRoutes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { apiRateLimit } from "./middleware/apiRateLimit.ts";
import { notFoundHandler } from "./middleware/notFound.ts";
import { getAllowedOrigins } from "./services/socketService.ts";

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(currentDirectory, "../../frontend/dist");

app.use(helmet());
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(express.json({ limit: "7mb" }));
app.use(express.urlencoded({ extended: true, limit: "7mb" }));

app.get("/", (req, res) => {
  if (process.env.NODE_ENV !== "production") {
    res.send("ReStyle API is running");
    return;
  }
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, service: "ReStyle API" });
});

app.use("/api", apiRateLimit);

app.get("/api/public/contact", (_req, res) => {
  const email = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();
  if (!email) {
    res.status(503).json({ success: false, message: "Contact email is not configured" });
    return;
  }
  res.json({ email });
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/marketplace-favorites", marketplaceFavoriteRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/restyle-projects", restyleProjectRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDistPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
