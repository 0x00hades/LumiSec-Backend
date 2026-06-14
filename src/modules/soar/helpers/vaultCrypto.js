import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = () => {
    const secret = process.env.VAULT_ENCRYPTION_KEY || process.env.JWT_SECRET || "lumisec-default-vault-key-32chars!";
    return crypto.createHash("sha256").update(secret).digest();
};

export const encryptSecret = (plaintext) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        encryptedValue: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64")
    };
};

export const decryptSecret = ({ encryptedValue, iv, authTag }) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64")),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
};

export const maskSecret = (value) => {
    if (!value || value.length < 4) return "****";
    return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 12))}${value.slice(-2)}`;
};
