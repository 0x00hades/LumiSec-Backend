import { model, Schema } from "mongoose";

const landingPageSchema = new Schema({
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    htmlContent: { type: String, required: true },
    redirectUrl: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

landingPageSchema.index({ name: 1 });

export const LandingPage = model("LandingPage", landingPageSchema);
