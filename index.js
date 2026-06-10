import express from "express";
import dotenv from "dotenv";
import { createServer } from "http";
import { bootstrap } from "./src/bootstrap.js";
import { connectDB } from "./database/connection.js";
import { initSocket } from "./src/utils/socket.js";

dotenv.config({ path: "./config/.env" });

const app = express();
const httpServer = createServer(app);

// Init WebSocket
initSocket(httpServer);

// Connect DB
connectDB();

// Bootstrap routes & middleware
bootstrap(app, express);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`LumiSec running on port ${PORT}`);
});
