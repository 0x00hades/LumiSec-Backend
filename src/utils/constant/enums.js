export const roles = {
    ADMIN: "admin",
    SOC_ANALYST: "soc_analyst",
    SOC_MANAGER: "soc_manager",
    RED_TEAM: "red_team",
    DETECTION_ENGINEER: "detection_engineer",
    AUDITOR: "auditor",
    COMPLIANCE_MANAGER: "compliance_manager",
    IT_MANAGER: "it_manager",
    ASSIGNEE: "assignee"
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
    RESOLVED: "resolved",
    PENDING_VALIDATION: "pending_validation",
    PENDING_RETEST: "pending_retest",
    REOPENED: "reopened",
    CLOSED: "closed"
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
