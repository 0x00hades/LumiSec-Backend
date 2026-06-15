import { roles } from "../../utils/constant/enums.js";

export const grcPermissions = {
    findings: {
        create: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        read: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER, roles.IT_MANAGER, roles.SOC_MANAGER, roles.SOC_ANALYST],
        update: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        delete: [roles.ADMIN, roles.GRC_MANAGER],
        assign: [roles.ADMIN, roles.GRC_MANAGER, roles.IT_MANAGER],
        close: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        reopen: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        retest: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER, roles.DETECTION_ENGINEER]
    },
    risks: {
        create: [roles.ADMIN, roles.GRC_MANAGER, roles.SOC_MANAGER],
        read: [roles.ADMIN, roles.GRC_MANAGER, roles.AUDITOR, roles.COMPLIANCE_MANAGER, roles.SOC_MANAGER],
        update: [roles.ADMIN, roles.GRC_MANAGER],
        accept: [roles.ADMIN, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER],
        mitigate: [roles.ADMIN, roles.GRC_MANAGER, roles.IT_MANAGER],
        close: [roles.ADMIN, roles.GRC_MANAGER]
    },
    tasks: {
        create: [roles.ADMIN, roles.IT_MANAGER, roles.GRC_MANAGER],
        read: [roles.ADMIN, roles.IT_MANAGER, roles.GRC_MANAGER, roles.ASSIGNEE, roles.AUDITOR],
        update: [roles.ADMIN, roles.IT_MANAGER, roles.GRC_MANAGER, roles.ASSIGNEE],
        complete: [roles.ADMIN, roles.IT_MANAGER, roles.ASSIGNEE],
        verify: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER]
    },
    evidence: {
        create: [roles.ADMIN, roles.IT_MANAGER, roles.ASSIGNEE, roles.AUDITOR],
        read: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER, roles.IT_MANAGER, roles.ASSIGNEE],
        delete: [roles.ADMIN, roles.GRC_MANAGER, roles.AUDITOR]
    },
    reports: {
        create: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        read: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER],
        update: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER],
        delete: [roles.ADMIN, roles.GRC_MANAGER],
        generate: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER]
    },
    compliance: {
        create: [roles.ADMIN, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER],
        read: [roles.ADMIN, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER, roles.AUDITOR],
        update: [roles.ADMIN, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER],
        link: [roles.ADMIN, roles.GRC_MANAGER, roles.COMPLIANCE_MANAGER]
    },
    dashboard: {
        read: [roles.ADMIN, roles.GRC_MANAGER, roles.AUDITOR, roles.COMPLIANCE_MANAGER, roles.SOC_MANAGER, roles.IT_MANAGER]
    },
    auditLogs: {
        read: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER]
    },
    notifications: {
        read: [roles.ADMIN, roles.AUDITOR, roles.GRC_MANAGER, roles.IT_MANAGER, roles.ASSIGNEE, roles.COMPLIANCE_MANAGER, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.DETECTION_ENGINEER]
    },
    integrations: {
        network: [roles.ADMIN, roles.GRC_MANAGER, roles.DETECTION_ENGINEER, roles.SOC_MANAGER, roles.INTEGRATION_ADMIN],
        uctc: [roles.ADMIN, roles.GRC_MANAGER, roles.DETECTION_ENGINEER, roles.INTEGRATION_ADMIN],
        soar: [roles.ADMIN, roles.GRC_MANAGER, roles.SOC_MANAGER, roles.INTEGRATION_ADMIN],
        phishing: [roles.ADMIN, roles.GRC_MANAGER, roles.SOC_MANAGER, roles.INTEGRATION_ADMIN],
        siem: [roles.ADMIN, roles.GRC_MANAGER, roles.SOC_ANALYST, roles.DETECTION_ENGINEER, roles.INTEGRATION_ADMIN],
        opencti: [roles.ADMIN, roles.GRC_MANAGER, roles.SOC_ANALYST, roles.INTEGRATION_ADMIN]
    }
};
