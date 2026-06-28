import { PhishingSettings } from "../../../../database/index.js";
import {
    isLocalTrackingDomain,
    resolveTrackingDomainForEmail
} from "../helpers/trackingDomain.js";

const SETTINGS_KEY = "default";
const DEFAULT_FROM = "LumiSec <noreply@lumisec.io>";

async function getStoredSettings() {
    return PhishingSettings.findOne({ singletonKey: SETTINGS_KEY }).lean();
}

export async function getFromAddress() {
    const stored = await getStoredSettings();
    if (stored?.fromAddress) return stored.fromAddress;
    return process.env.SMTP_FROM || DEFAULT_FROM;
}

export async function getSettings(req) {
    const stored = await getStoredSettings();
    const fromAddress = stored?.fromAddress || process.env.SMTP_FROM || DEFAULT_FROM;
    const fromSource = stored?.fromAddress
        ? "database"
        : process.env.SMTP_FROM
            ? "environment"
            : "default";

    const { domain: trackingDomain, source: trackingDomainSource } = await resolveTrackingDomainForEmail({
        storedSettings: stored,
        req
    });

    return {
        fromAddress,
        source: fromSource,
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        trackingDomain,
        trackingDomainSource,
        openTrackingEnabled: true,
        trackingDomainIsLocal: isLocalTrackingDomain(trackingDomain),
        updatedAt: stored?.updatedAt ?? null
    };
}

export async function updateSettings({ fromAddress, trackingDomain }, req) {
    const updates = {};
    if (fromAddress !== undefined) updates.fromAddress = fromAddress;
    if (trackingDomain !== undefined) {
        updates.trackingDomain = trackingDomain?.trim() ? trackingDomain.trim() : null;
    }

    const settings = await PhishingSettings.findOneAndUpdate(
        { singletonKey: SETTINGS_KEY },
        updates,
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const resolvedFrom = settings.fromAddress || process.env.SMTP_FROM || DEFAULT_FROM;
    const { domain: resolvedTracking, source: trackingDomainSource } = await resolveTrackingDomainForEmail({
        storedSettings: settings.toObject(),
        req
    });

    return {
        fromAddress: resolvedFrom,
        source: settings.fromAddress ? "database" : (process.env.SMTP_FROM ? "environment" : "default"),
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        trackingDomain: resolvedTracking,
        trackingDomainSource,
        openTrackingEnabled: true,
        trackingDomainIsLocal: isLocalTrackingDomain(resolvedTracking),
        updatedAt: settings.updatedAt
    };
}

export { getStoredSettings };
