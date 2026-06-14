import { model, Schema } from "mongoose";

const credentialVaultSchema = new Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String },
    encryptedValue: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date }
}, { timestamps: true });

credentialVaultSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
credentialVaultSchema.index({ deletedAt: 1 });

credentialVaultSchema.pre(/^find/, function (next) {
    if (!this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    next();
});

export const CredentialVault = model("CredentialVault", credentialVaultSchema);
