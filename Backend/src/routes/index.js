import { Router } from "express";

import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { studentRouter } from "./student.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/student", studentRouter);

