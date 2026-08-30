import mongoose from "mongoose";
import { createServer } from "http";
import app from "./app.ts";
import { initializeSocketServer } from "./services/socketService.ts";
import logger from "./services/logger.ts";

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  logger.fatal("MONGO_URI is missing");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    logger.info("MongoDB connected");
    const httpServer = createServer(app);
    initializeSocketServer(httpServer);
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT }, "Server is listening");
    });
  })
  .catch((err) => {
    logger.fatal({ err }, "MongoDB connection failed");
    process.exit(1);
  });
