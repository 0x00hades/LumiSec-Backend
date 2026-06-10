import { model, Schema } from "mongoose";
import { roles, userStatus } from "../../src/utils/constant/enums.js";

const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(roles), required: true },
    status: { type: String, enum: Object.values(userStatus), default: userStatus.ACTIVE },
    department: { type: String },
    lastLogin: { type: Date }
}, { timestamps: true });

export const User = model("User", userSchema);
