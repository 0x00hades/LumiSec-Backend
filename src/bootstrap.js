import path from "path";
import { fileURLToPath } from "url";
import { configureCors } from "./middleware/cors.js";
import { globalErrorHandling } from "./middleware/globalErrorHandling.js";
import { authRouter, phishingRouter, soarRouter, uctcRouter, grcRouter, networkRouter } from "./modules/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const bootstrap = (app, express) => {
    // Trust reverse proxy (nginx, cloud load balancers) for correct tracking URLs in production.
    app.set("trust proxy", 1);

    // 1. CORS must run before auth and route handlers (handles preflight OPTIONS).
    configureCors(app);

    // 2. Body parsers
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 3. Public endpoints (no authentication)
    const healthHandler = (req, res) => res.json({ status: "ok", service: "LumiSec API" });
    app.get("/health", healthHandler);
    app.get("/api/health", healthHandler);

    app.get("/api/grc/docs/openapi.json", (_req, res) => {
        res.sendFile(path.resolve(__dirname, "../docs/grc-openapi.json"));
    });

    app.get("/api/soar/docs/openapi.json", (_req, res) => {
        res.sendFile(path.resolve(__dirname, "../docs/soar-openapi.json"));
    });

    // 4. Public auth routes (login/signup are unauthenticated inside authRouter)
    app.use("/api/auth", authRouter);

    // 5. Protected module routes (each router applies isAuthenticated where required)
    app.use("/api/phishing", phishingRouter);
    app.use("/api/soar", soarRouter);
    app.use("/api/uctc", uctcRouter);
    app.use("/api/grc", grcRouter);
    app.use("/api/luminet", networkRouter);

    app.use("/api/v1", uctcRouter);
    app.use("/api/v1", networkRouter);

    app.all("*", (req, res) => {
        res.status(404).json({ success: false, message: "Route not found" });
    });

    app.use(globalErrorHandling);
};
