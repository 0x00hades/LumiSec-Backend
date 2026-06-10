import { Server } from "socket.io";
import { verifyToken } from "./token.js";

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication required"));
        try {
            socket.user = verifyToken(token);
            next();
        } catch {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        // Join room based on role for targeted alerts
        socket.join(socket.user.role);
        socket.join(`user:${socket.user._id}`);
    });

    return io;
};

// Call this from anywhere to emit real-time events
export const emitAlert = (room, event, data) => {
    if (io) io.to(room).emit(event, data);
};

export const getIO = () => io;
