import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { signupValidation, loginValidation } from "./auth.validation.js";
import { signup, login, getProfile } from "./auth.controller.js";

const authRouter = Router();

authRouter.post("/signup", isValid(signupValidation), asyncHandler(signup));
authRouter.post("/login",  isValid(loginValidation),  asyncHandler(login));
authRouter.get("/profile", isAuthenticated(),          asyncHandler(getProfile));

export default authRouter;
