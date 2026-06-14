import { PhishingRisk, Recipient, Risk } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    phishingEventType, phishingRiskLevel, riskLevel, riskStatus, sourceModule, severity
} from "../../../utils/constant/enums.js";
import { calculatePenalty, isHighRiskScore } from "../../../utils/helpers/penaltyCalc.js";
import { riskQueue } from "../../../utils/queue.js";

const RISK_LEVEL_MAP = {
    [phishingRiskLevel.LOW]: riskLevel.LOW,
    [phishingRiskLevel.MEDIUM]: riskLevel.MEDIUM,
    [phishingRiskLevel.HIGH]: riskLevel.HIGH,
    [phishingRiskLevel.CRITICAL]: riskLevel.CRITICAL
};

export const determineRiskLevel = (reason, recipient) => {
    if (reason === "credential_submitted") return phishingRiskLevel.CRITICAL;
    if (reason === "multiple_clicks") return phishingRiskLevel.HIGH;
    if (reason === "high_risk_user" || isHighRiskScore(recipient.riskScore)) return phishingRiskLevel.HIGH;
    return phishingRiskLevel.MEDIUM;
};

export const evaluateAutoRisk = async ({ recipientId, campaignId, eventType, clickCount, riskScore, userId }) => {
    const triggers = [];

    if (eventType === phishingEventType.CREDENTIAL_SUBMITTED) {
        triggers.push("credential_submitted");
    }
    if (clickCount >= 2) {
        triggers.push("multiple_clicks");
    }
    if (isHighRiskScore(riskScore)) {
        triggers.push("high_risk_user");
    }

    for (const reason of triggers) {
        await riskQueue.add("createPhishingRisk", {
            recipientId,
            campaignId,
            reason,
            eventType,
            userId
        });
    }
};

export const createPhishingRisk = async ({ recipientId, campaignId, reason, eventType, userId }) => {
    const recipient = await Recipient.findById(recipientId);
    if (!recipient) throw new AppError(messages.recipient.notFound, 404);

    const level = determineRiskLevel(reason, recipient);

    const existing = await PhishingRisk.findOne({ recipientId, campaignId, reason });
    if (existing) return existing;

    const grcRisk = await Risk.create({
        title: `Phishing risk: ${reason.replace(/_/g, " ")}`,
        description: `Auto-generated from phishing event (${eventType || reason}) for ${recipient.email}`,
        likelihood: level === phishingRiskLevel.CRITICAL ? 5 : level === phishingRiskLevel.HIGH ? 4 : 3,
        impact: level === phishingRiskLevel.CRITICAL ? 5 : 4,
        owner: userId,
        status: riskStatus.OPEN
    });

    const phishingRisk = await PhishingRisk.create({
        recipientId,
        campaignId,
        riskLevel: level,
        reason,
        grcRiskId: grcRisk._id
    });

    return { phishingRisk, grcRisk, grcRiskLevel: RISK_LEVEL_MAP[level] };
};

export const applyRiskPenalty = async (recipientId, eventType) => {
    const penalty = calculatePenalty(eventType);
    if (!penalty) return null;

    const recipient = await Recipient.findByIdAndUpdate(
        recipientId,
        { $inc: { riskScore: -penalty } },
        { new: true }
    );

    if (recipient) {
        recipient.riskScore = Math.max(0, recipient.riskScore);
        await recipient.save();
    }

    return recipient;
};

export const listPhishingRisks = async (query = {}) => {
    const filter = {};
    if (query.campaignId) filter.campaignId = query.campaignId;
    if (query.riskLevel) filter.riskLevel = query.riskLevel;

    return PhishingRisk.find(filter)
        .sort({ createdAt: -1 })
        .populate("recipientId", "email fullName department")
        .populate("grcRiskId", "title status riskLevel");
};

export const buildGrcRiskPayload = (phishingRisk, recipient, eventType) => ({
    title: `Phishing: ${phishingRisk.reason}`,
    description: `User ${recipient.email} triggered ${eventType || phishingRisk.reason} in campaign ${phishingRisk.campaignId}`,
    eventType: eventType || phishingRisk.reason,
    owner: recipient._id,
    severity: phishingRisk.riskLevel === phishingRiskLevel.CRITICAL ? severity.CRITICAL : severity.HIGH,
    sourceModule: sourceModule.PHISHING,
    sourceId: String(phishingRisk._id)
});
