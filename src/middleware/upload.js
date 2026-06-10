import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../utils/appError.js";

const uploadDir = process.env.UPLOAD_DIR || "uploads/evidence";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "text/plain",
        "application/json",
        "application/zip"
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new AppError("Unsupported file type", 400), false);
};

export const evidenceUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});
