import Joi from "joi";
import { roles } from "../../utils/constant/enums.js";

export const signupValidation = Joi.object({
    name: Joi.string().min(2).max(60).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid(...Object.values(roles)).required(),
    department: Joi.string().optional()
});

export const loginValidation = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});
