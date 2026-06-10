import { AppError } from "../utils/appError.js";
import { verifyToken } from "../utils/token.js";
import { User } from "../../database/index.js";
import { messages } from "../utils/constant/messages.js";
import { userStatus } from "../utils/constant/enums.js";

export const isAuthenticated = () => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next(new AppError(messages.auth.notAuthenticated, 401));
        }

        const token = authHeader.split(" ")[1];

        try {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded._id).select("-password");
            if (!user) return next(new AppError(messages.user.notFound, 404));
            if (user.status === userStatus.SUSPENDED) {
                return next(new AppError(messages.auth.accountSuspended, 403));
            }

            req.authUser = user;
            next();
        } catch {
            return next(new AppError(messages.auth.tokenExpired, 401));
        }
    };
};
