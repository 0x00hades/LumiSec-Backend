import { phishingEventType } from "../constant/enums.js";

const PENALTIES = {
    [phishingEventType.EMAIL_OPENED]: 10,
    [phishingEventType.LINK_CLICKED]: 25,
    [phishingEventType.FORM_VISITED]: 30,
    [phishingEventType.CREDENTIAL_SUBMITTED]: 50,
    [phishingEventType.ATTACHMENT_DOWNLOADED]: 35,
    [phishingEventType.QR_SCANNED]: 30
};

export const calculatePenalty = (eventType) => PENALTIES[eventType] || 0;

export const isHighRiskScore = (riskScore) => riskScore <= 40;
