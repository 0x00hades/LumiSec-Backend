const TRACKING_PATH = "/api/phishing";
export const LOCALHOST_TRACKING_DOMAIN = "http://localhost:3000/api/phishing";

export function isLocalTrackingDomain(domain = "") {
    return /localhost|127\.0\.0\.1|::1/i.test(domain);
}

export function normalizeTrackingBase(url = "") {
    const trimmed = String(url).trim().replace(/\/$/, "");
    if (!trimmed) return "";
    if (trimmed.endsWith(TRACKING_PATH)) return trimmed;
    if (/\/api\/phishing$/i.test(trimmed)) return trimmed;
    return `${trimmed}${TRACKING_PATH}`;
}

export function resolveTrackingDomainFromRequest(req) {
    if (!req) return null;
    const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    if (!host) return null;
    return normalizeTrackingBase(`${proto}://${host}`);
}

function resolveFromEnv() {
    if (process.env.NGROK_URL) {
        return {
            domain: normalizeTrackingBase(process.env.NGROK_URL),
            source: "environment"
        };
    }

    if (process.env.PHISHING_TRACKING_DOMAIN) {
        return {
            domain: normalizeTrackingBase(process.env.PHISHING_TRACKING_DOMAIN),
            source: "environment"
        };
    }

    const apiBase = process.env.API_PUBLIC_URL || process.env.PUBLIC_API_URL || process.env.APP_URL;
    if (apiBase) {
        return {
            domain: normalizeTrackingBase(apiBase),
            source: "environment"
        };
    }

    return null;
}

/**
 * Resolve tracking URL for embedding in outbound emails.
 * Prefers any public (non-localhost) domain so inbox clients (Gmail, Outlook web)
 * can load the open pixel when the recipient opens the message.
 */
export async function resolveTrackingDomainForEmail({
    override,
    campaign,
    storedSettings,
    req
} = {}) {
    if (override && !isLocalTrackingDomain(normalizeTrackingBase(override))) {
        return { domain: normalizeTrackingBase(override), source: "launch" };
    }

    const candidates = [];

    if (storedSettings?.trackingDomain) {
        candidates.push({
            domain: normalizeTrackingBase(storedSettings.trackingDomain),
            source: "database"
        });
    }

    const fromEnv = resolveFromEnv();
    if (fromEnv) candidates.push(fromEnv);

    if (override) {
        candidates.push({ domain: normalizeTrackingBase(override), source: "launch" });
    }

    if (campaign?.trackingDomain) {
        candidates.push({
            domain: normalizeTrackingBase(campaign.trackingDomain),
            source: "campaign"
        });
    }

    const fromRequest = resolveTrackingDomainFromRequest(req);
    if (fromRequest) {
        candidates.push({ domain: fromRequest, source: "request" });
    }

    const publicCandidate = candidates.find((c) => !isLocalTrackingDomain(c.domain));
    if (publicCandidate) return publicCandidate;

    if (candidates.length) return candidates[0];

    return { domain: LOCALHOST_TRACKING_DOMAIN, source: "default" };
}

/**
 * Resolve the public base URL embedded in simulation emails for open/click tracking.
 * Priority: launch override → campaign → DB settings → env → request host → localhost.
 */
export async function resolveTrackingDomain({
    override,
    campaign,
    storedSettings,
    req
} = {}) {
    if (override) {
        return { domain: normalizeTrackingBase(override), source: "launch" };
    }

    if (campaign?.trackingDomain) {
        return { domain: normalizeTrackingBase(campaign.trackingDomain), source: "campaign" };
    }

    if (storedSettings?.trackingDomain) {
        return { domain: normalizeTrackingBase(storedSettings.trackingDomain), source: "database" };
    }

    const fromEnv = resolveFromEnv();
    if (fromEnv) return fromEnv;

    const fromRequest = resolveTrackingDomainFromRequest(req);
    if (fromRequest) {
        return { domain: fromRequest, source: "request" };
    }

    return { domain: LOCALHOST_TRACKING_DOMAIN, source: "default" };
}

/** Sync fallback when only an explicit domain string is available (e.g. email worker job). */
export function resolveTrackingBaseSync(explicit) {
    if (explicit && !isLocalTrackingDomain(normalizeTrackingBase(explicit))) {
        return normalizeTrackingBase(explicit);
    }
    const fromEnv = resolveFromEnv();
    if (fromEnv && !isLocalTrackingDomain(fromEnv.domain)) return fromEnv.domain;
    if (explicit) return normalizeTrackingBase(explicit);
    return LOCALHOST_TRACKING_DOMAIN;
}
