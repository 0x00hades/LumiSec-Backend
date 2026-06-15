import Joi from "joi";

const ipv4 = Joi.string().ip({ version: ["ipv4"] });
const cidr = Joi.string().ip({ version: ["ipv4"], cidr: "required" });
const objectId = Joi.string().hex().length(24);
const macAddress = Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/);
const portList = Joi.string().custom((value, helpers) => {
    for (const part of value.split(",")) {
        const trimmed = part.trim();
        const [startValue, endValue] = trimmed.split("-");
        const start = Number(startValue);
        const end = endValue === undefined ? start : Number(endValue);

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 65535 || start > end) {
            return helpers.error("any.invalid");
        }
    }

    return value;
}, "port list validation");

// Validates discovery requests for one IPv4 CIDR subnet.
export const discoverNetworkValidation = Joi.object({
    subnet: cidr.required()
});

// Validates port scan requests and blocks impossible port ranges before scanning.
export const scanPortsValidation = Joi.object({
    target: ipv4.required(),
    ports: portList.required(),
    type: Joi.string().valid("SYN", "CONNECT", "UDP").default("CONNECT")
});

// Validates asset inventory filters.
export const listAssetsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    os_type: Joi.string().optional(),
    status: Joi.string().valid("active", "inactive", "unknown").optional(),
    search: Joi.string().optional()
});

// Validates MAC-address lookups for asset details.
export const assetDetailsValidation = Joi.object({
    mac: macAddress.required()
});

// Validates IP-based context lookups used by other LumiSec tools.
export const assetContextValidation = Joi.object({
    ip: ipv4.required()
});

// Validates packet capture session requests.
export const startSniffingValidation = Joi.object({
    interface: Joi.string().min(1).max(100).required(),
    duration_sec: Joi.number().integer().min(1).max(3600).default(300),
    filter: Joi.string().max(500).allow("").optional()
});

// Validates HTTP fallback reads for recent live-stream packet samples.
export const liveStreamValidation = Joi.object({
    session_id: objectId.optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
});

// Validates filters for detected weak services and misconfigurations.
export const listMisconfigurationsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
    status: Joi.string().valid("open", "accepted", "resolved").optional(),
    asset_ip: ipv4.optional()
});

// Validates integration payloads for outbound network calls.
export const networkGrcFindingValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    severity: Joi.string().valid("low", "medium", "high", "critical").required(),
    asset: ipv4.optional(),
    sourceId: Joi.string().required(),
    findingType: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

export const networkSoarIncidentValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
    sourceIp: ipv4.optional(),
    asset: Joi.string().optional(),
    sourceId: Joi.string().optional(),
    findingType: Joi.string().optional()
});

export const networkUctcGapValidation = Joi.object({
    assetIp: ipv4.optional(),
    assetMac: macAddress.optional(),
    service: Joi.string().optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    gapType: Joi.string().optional(),
    description: Joi.string().optional()
});

export const networkSiemEventValidation = Joi.object({
    eventType: Joi.string().optional(),
    scanId: Joi.string().optional(),
    target: Joi.string().optional(),
    assetCount: Joi.number().integer().optional(),
    severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
    metadata: Joi.object().optional()
});

export const networkOpenCtiValidation = Joi.object({
    ip: ipv4.optional(),
    domain: Joi.string().optional(),
    hash: Joi.string().optional(),
    cve: Joi.string().optional()
});

// Validates flow metric filters and anomaly-only queries.
export const flowMetricsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    source_ip: ipv4.optional(),
    anomaly_only: Joi.boolean().truthy("true").falsy("false").optional()
});
