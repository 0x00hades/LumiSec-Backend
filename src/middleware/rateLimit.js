const buckets = new Map();

export const rateLimit = ({ windowMs = 60_000, max = 60, keyFn = (req) => req.ip }) => {
    return (req, res, next) => {
        const key = keyFn(req) || req.ip || "unknown";
        const now = Date.now();
        const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + windowMs;
        }

        bucket.count += 1;
        buckets.set(key, bucket);

        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));

        if (bucket.count > max) {
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please try again later."
            });
        }

        return next();
    };
};
