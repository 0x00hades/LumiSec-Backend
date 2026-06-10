import { globalErrorHandling } from "./middleware/globalErrorHandling.js";
import { authRouter, phishingRouter, soarRouter, uctcRouter, grcRouter } from "./modules/index.js";

export const bootstrap = (app, express) => {
    app.use(express.json());

    // Health check
    app.get("/health", (req, res) => res.json({ status: "ok", service: "LumiSec API" }));

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
