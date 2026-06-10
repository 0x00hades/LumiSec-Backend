import { phishingEventType } from "../constant/enums.js";

const PENALTIES = {
    [phishingEventType.OPEN]:   10,
    [phishingEventType.CLICK]:  25,
    [phishingEventType.SUBMIT]: 50
};

export const calculatePenalty = (eventType) => {
    return PENALTIES[eventType] || 0;
};
