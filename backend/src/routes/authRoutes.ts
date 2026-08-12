import { Router } from "express";
import { login, register } from "../controllers/authController.ts";
import { validate } from "../middleware/validate.ts";
import {
  loginSchema,
  registerSchema
} from "../validation/authValidation.ts";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  register
);

router.post(
  "/login",
  validate(loginSchema),
  login
);

export default router;