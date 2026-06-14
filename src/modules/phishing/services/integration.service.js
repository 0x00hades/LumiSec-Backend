import { Incident } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    incidentSeverity, incidentStatus, sourceModule, severity
} from "../../../utils/constant/enums.js";
import { ingestPhishingRisk as ingestGrcPhishingRisk } from "../../grc/services/integration.service.js";
import { forwardPhishingEventToSiem } from "../../../integrations/phishingSiem.js";
import axios from "axios";
import * as riskService from "./risk.service.js";

export const pushGrcRisk = async (payload, user) => {
    const risk = await ingestGrcPhishingRisk(payload, user);
    return risk;
};

export const pushSoarIncident = async (payload, user) => {
    const incident = await Incident.create({
        title: payload.title || `Phishing incident: ${payload.eventType}`,
        description: payload.description || `Phishing simulation incident for campaign ${payload.campaignId}`,
        severity: payload.severity || incidentSeverity.HIGH,
        status: incidentStatus.NEW,
        sourceIP: payload.sourceIp,
        reportedBy: user._id,
        tags: ["phishing", payload.eventType || "simulation"]
    });

    return incident;
};

export const pushSiemEvent = async (payload) => {
    await forwardPhishingEventToSiem({
        eventType: payload.eventType,
        campaignId: payload.campaignId,
        recipientId: payload.recipientId,
        ipAddress: payload.sourceIp,
        userAgent: payload.userAgent,
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: payload.metadata || {}
    });

    return { forwarded: true, index: process.env.PHISHING_SIEM_INDEX || "lumisec-phishing-events" };
};

export const pushOpenCtiIndicator = async (payload) => {
    const mutation = `
        mutation IndicatorAdd($input: IndicatorAddInput!) {
            indicatorAdd(input: $input) { id name }
        }
    `;

    try {
        const response = await axios.post(
            `${process.env.OPENCTI_URL}/graphql`,
            {
                query: mutation,
                variables: {
                    input: {
                        name: payload.name || `Phishing indicator: ${payload.value}`,
                        pattern: payload.pattern || `[domain-name:value = '${payload.value}']`,
                        pattern_type: "stix",
                        x_opencti_main_observable_type: payload.observableType || "Domain-Name"
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENCTI_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data?.data?.indicatorAdd || { created: true };
    } catch (error) {
        throw new AppError(`${messages.integration.openctiError}: ${error.message}`, 502);
    }
};

export const autoIntegrateOnRisk = async ({ phishingRisk, recipient, eventType, userId }) => {
    const grcPayload = riskService.buildGrcRiskPayload(phishingRisk, recipient, eventType);

    await pushSiemEvent({
        eventType: eventType || phishingRisk.reason,
        campaignId: phishingRisk.campaignId,
        recipientId: phishingRisk.recipientId,
        metadata: { reason: phishingRisk.reason, riskLevel: phishingRisk.riskLevel }
    });

    if (phishingRisk.riskLevel === "critical" || phishingRisk.riskLevel === "high") {
        await pushSoarIncident({
            title: `Phishing: ${recipient.email} - ${phishingRisk.reason}`,
            description: grcPayload.description,
            campaignId: phishingRisk.campaignId,
            eventType,
            sourceIp: null,
            severity: incidentSeverity.HIGH
        }, { _id: userId });
    }
};
