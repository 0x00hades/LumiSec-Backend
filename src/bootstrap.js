import path from "path";
import { fileURLToPath } from "url";
import { globalErrorHandling } from "./middleware/globalErrorHandling.js";
import { authRouter, phishingRouter, soarRouter, uctcRouter, grcRouter } from "./modules/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const bootstrap = (app, express) => {
    app.use(express.json());

    // Health check
    app.get("/health", (req, res) => res.json({ status: "ok", service: "LumiSec API" }));

    // GRC OpenAPI documentation
    app.get("/api/grc/docs/openapi.json", (_req, res) => {
        res.sendFile(path.resolve(__dirname, "../docs/grc-openapi.json"));
    });

    // API Routes
    app.use("/api/auth",     authRouter);
    app.use("/api/phishing", phishingRouter);
    app.use("/api/soar",     soarRouter);
    app.use("/api/uctc",     uctcRouter);
    app.use("/api/grc",      grcRouter);

    // 404
    app.all("*", (req, res) => {
        res.status(404).json({ success: false, message: "Route not found" });
    });

    // Global error handler
    app.use(globalErrorHandling);
};
