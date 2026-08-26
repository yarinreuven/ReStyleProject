import express from "express";
import multer from "multer";

import {
  createRestyleProject,
  deleteRestyleProject,
  getRestyleProject,
  getRestyleProjects,
  generateRestyleIdeas,
  selectRestyleIdea,
  updateRestyleProject
} from "../controllers/restyleProjectController.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import {
  updateRestyleProjectSchema,
  validateRestyleProjectCreate,
  validateRestyleProjectId,
  validateRestyleIdeaParams
} from "../validation/restyleProjectValidation.ts";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  }
});

router.use(authenticateToken);
router.post("/", upload.single("sourceImage"), validateRestyleProjectCreate, createRestyleProject);
router.get("/", getRestyleProjects);
router.post("/:projectId/ideas", validateRestyleProjectId, generateRestyleIdeas);
router.post("/:projectId/ideas/:ideaId/select", validateRestyleIdeaParams, selectRestyleIdea);
router.get("/:projectId", validateRestyleProjectId, getRestyleProject);
router.patch("/:projectId", validateRestyleProjectId, validate(updateRestyleProjectSchema), updateRestyleProject);
router.delete("/:projectId", validateRestyleProjectId, deleteRestyleProject);

export default router;
