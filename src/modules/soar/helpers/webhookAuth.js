import crypto from "crypto";

export const verifyWebhookSignature = (payload, signature, secret) => {
    if (!secret) return true;
    if (!signature) return false;

    const expected = crypto
        .createHmac("sha256", secret)
        .update(typeof payload === "string" ? payload : JSON.stringify(payload))
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature.replace(/^sha256=/, ""))
    );
};
