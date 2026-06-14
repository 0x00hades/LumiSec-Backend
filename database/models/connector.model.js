import { model, Schema } from "mongoose";
import { connectorType } from "../../src/utils/constant/enums.js";

const connectorSchema = new Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(connectorType), required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    vaultId: { type: Schema.Types.ObjectId, ref: "CredentialVault" },
    isActive: { type: Boolean, default: true },
    lastTestedAt: { type: Date },
    lastTestStatus: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date }
}, { timestamps: true });

connectorSchema.index({ type: 1, isActive: 1 });
connectorSchema.index({ deletedAt: 1 });

connectorSchema.pre(/^find/, function (next) {
    if (!this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    next();
});

export const Connector = model("Connector", connectorSchema);
