import crypto from "crypto";

export const generateTrackingId = () => crypto.randomBytes(16).toString("hex");
