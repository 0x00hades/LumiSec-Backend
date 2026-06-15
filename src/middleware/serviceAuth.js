import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";
import { roles } from "../utils/constant/enums.js";
import { isAuthenticated } from "./authentication.js";

const SERVICE_USER = {
    _id: "000000000000000000000001",
    name: "LumiSec Integration Service",
    email: "integration@lumisec.internal",
    role: roles.INTEGRATION_ADMIN,
    department: "SOC"
};

export const isServiceAuthenticated = () => {
    return (req, res, next) => {
        const apiKey = req.headers["x-internal-api-key"];
        const expected = process.env.INTERNAL_API_KEY;

        if (apiKey && expected && apiKey === expected) {
            req.authUser = SERVICE_USER;
            req.isServiceAccount = true;
            return next();
        }

        return next(new AppError(messages.auth.notAuthenticated, 401));
    };
};

export const isServiceOrUserAuthenticated = () => {
    const jwtAuth = isAuthenticated();

    return (req, res, next) => {
        const apiKey = req.headers["x-internal-api-key"];
        const expected = process.env.INTERNAL_API_KEY;

        if (apiKey && expected && apiKey === expected) {
            req.authUser = SERVICE_USER;
            req.isServiceAccount = true;
            return next();
        }

        return jwtAuth(req, res, next);
    };
};
