import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.ts";
import itemRoutes from "./routes/itemRoutes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReStyle API is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);

app.use(errorHandler);

export default app;