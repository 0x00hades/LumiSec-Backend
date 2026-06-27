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

export const updateProfileValidation = Joi.object({
    name: Joi.string().min(2).max(60).optional(),
    password: Joi.string().min(8).optional(),
    currentPassword: Joi.string().optional()
}).custom((value, helpers) => {
    if (value.password && !value.currentPassword) {
        return helpers.message("Current password is required when setting a new password");
    }
    if (!value.name && !value.password) {
        return helpers.message("Provide a name or new password to update");
    }
    return value;
});
