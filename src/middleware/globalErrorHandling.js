import { logger } from "../utils/logger.js";

export const globalErrorHandling = (error, req, res, next) => {
    logger.error({
        message: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
    });

    const statusCode = error.statusCode || 500;
    const status = error.status || "error";

    return res.status(statusCode).json({
        success: false,
        status,
        message: error.message || "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: error.stack })
    });
};
