import dotenv from "dotenv";
import { createServer } from "http";
import { createApp } from "./src/app.js";
import { connectDB } from "./database/connection.js";
import { initSocket } from "./src/utils/socket.js";

dotenv.config({ path: "./config/.env" });

const app = createApp();
const httpServer = createServer(app);

// Init WebSocket
initSocket(httpServer);

// Connect DB
connectDB();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`LumiSec running on port ${PORT}`);
});
