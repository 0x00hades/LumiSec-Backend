import { model, Schema } from "mongoose";
import { retestResult } from "../../src/utils/constant/enums.js";

const retestSchema = new Schema({
    findingId: { type: Schema.Types.ObjectId, ref: "Finding", required: true },
    result: { type: String, enum: Object.values(retestResult), required: true },
    notes: { type: String },
    testedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    testedAt: { type: Date, default: Date.now }
}, { timestamps: true });

retestSchema.index({ findingId: 1, testedAt: -1 });

export const Retest = model("Retest", retestSchema);
