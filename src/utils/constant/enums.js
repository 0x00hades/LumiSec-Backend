export const roles = {
    ADMIN: "admin",
    SOC_ANALYST: "soc_analyst",
    SOC_MANAGER: "soc_manager",
    RED_TEAM: "red_team",
    DETECTION_ENGINEER: "detection_engineer",
    AUDITOR: "auditor",
    COMPLIANCE_MANAGER: "compliance_manager",
    IT_MANAGER: "it_manager",
    ASSIGNEE: "assignee",
    GRC_MANAGER: "grc_manager"
};

export const incidentStatus = {
    NEW: "new",
    IN_PROGRESS: "in_progress",
    ESCALATED: "escalated",
    RESOLVED: "resolved",
    CLOSED: "closed",
    FALSE_POSITIVE: "false_positive"
};

export const incidentSeverity = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
};

export const ruleStatus = {
    DRAFT: "draft",
    VALIDATED: "validated",
    CONVERTED: "converted",
    TESTING: "testing",
    DEPLOYED: "deployed",
    NOISY: "noisy",
    STALE: "stale",
    RETIRED: "retired"
};

export const sandboxRunStatus = {
    QUEUED: "queued",
    RUNNING: "running",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
    TIMED_OUT: "timed_out"
};

export const sandboxRunType = {
    SCRIPT: "script",
    SCENARIO: "scenario"
};

export const findingStatus = {
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    READY_FOR_RETEST: "ready_for_retest",
    PENDING_VALIDATION: "pending_validation",
    PENDING_RETEST: "pending_retest",
    RESOLVED: "resolved",
    CLOSED: "closed",
    REOPENED: "reopened"
};

export const sourceModule = {
    NETWORK: "network",
    UCTC: "uctc",
    SOAR: "soar",
    PHISHING: "phishing",
    SIEM: "siem",
    OPENCTI: "opencti",
    MANUAL: "manual"
};

export const severity = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
};

export const riskStatus = {
    OPEN: "open",
    MITIGATED: "mitigated",
    ACCEPTED: "accepted",
    CLOSED: "closed"
};

export const riskLevel = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
};

export const riskTreatment = {
    MITIGATE: "mitigate",
    ACCEPT: "accept",
    TRANSFER: "transfer",
    AVOID: "avoid"
};

export const taskStatus = {
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    VERIFIED: "verified"
};

export const taskPriority = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
};

export const complianceFramework = {
    ISO27001: "ISO27001",
    NIST: "NIST",
    PCI_DSS: "PCI_DSS",
    SOC2: "SOC2"
};

export const controlStatus = {
    COMPLIANT: "compliant",
    NON_COMPLIANT: "non_compliant",
    PARTIALLY_COMPLIANT: "partially_compliant",
    NOT_ASSESSED: "not_assessed"
};

export const retestResult = {
    PASS: "pass",
    FAIL: "fail"
};

export const auditAction = {
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    ASSIGN: "assign",
    CLOSE: "close",
    REOPEN: "reopen",
    ACCEPT: "accept",
    MITIGATE: "mitigate",
    COMPLETE: "complete",
    VERIFY: "verify",
    LINK: "link",
    GENERATE: "generate"
};

export const entityType = {
    FINDING: "finding",
    RISK: "risk",
    TASK: "task",
    EVIDENCE: "evidence",
    REPORT: "report",
    CONTROL: "control",
    RETEST: "retest",
    SIEM_ALERT: "siem_alert",
    NOTIFICATION: "notification"
};

export const notificationType = {
    FINDING: "finding",
    RISK: "risk",
    TASK: "task",
    REPORT: "report",
    COMPLIANCE: "compliance",
    RETEST: "retest",
    INTEGRATION: "integration"
};

export const campaignStatus = {
    DRAFT: "draft",
    ACTIVE: "active",
    COMPLETED: "completed",
    ARCHIVED: "archived"
};

export const phishingEventType = {
    OPEN: "open",
    CLICK: "click",
    SUBMIT: "submit"
};

export const playbookTrigger = {
    MANUAL: "manual",
    AUTO: "auto"
};

export const userStatus = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended"
};
