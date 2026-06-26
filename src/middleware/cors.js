import cors from "cors";

const parseAllowedOrigins = () => {
    const configured = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000";
    return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
};

export const corsOptions = {
    origin(origin, callback) {
        const allowedOrigins = parseAllowedOrigins();

        // Server-to-server clients (curl, Postman) send no Origin header.
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        if (process.env.NODE_ENV === "development" && /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Api-Key", "X-Requested-With"],
    exposedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
};

export const corsMiddleware = cors(corsOptions);

export const configureCors = (app) => {
    app.use(corsMiddleware);
    app.options("*", corsMiddleware);
};
