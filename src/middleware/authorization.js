import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

export const isAuthorized = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.authUser) {
            return next(new AppError(messages.auth.notAuthenticated, 401));
        }
        if (!allowedRoles.includes(req.authUser.role)) {
            return next(new AppError(messages.auth.notAuthorized, 403));
        }
        next();
    };
};
