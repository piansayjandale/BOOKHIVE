import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { adminController } from "../controllers/admin.controller.js";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(adminController.login));
