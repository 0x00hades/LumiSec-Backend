import { roles } from "../../utils/constant/enums.js";

export const phishingPermissions = {
    templates: {
        create: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER],
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR],
        update: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        delete: [roles.ADMIN, roles.PHISHING_MANAGER]
    },
    landingPages: {
        create: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR],
        update: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        delete: [roles.ADMIN, roles.PHISHING_MANAGER]
    },
    recipients: {
        create: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR],
        update: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        delete: [roles.ADMIN, roles.PHISHING_MANAGER]
    },
    campaigns: {
        create: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR],
        update: [roles.ADMIN, roles.PHISHING_MANAGER],
        delete: [roles.ADMIN, roles.PHISHING_MANAGER],
        manage: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR],
        launch: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR]
    },
    reports: {
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR],
        generate: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER]
    },
    dashboard: {
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR]
    },
    events: {
        read: [roles.ADMIN, roles.PHISHING_MANAGER, roles.PHISHING_OPERATOR, roles.SOC_MANAGER, roles.SOC_ANALYST, roles.AUDITOR]
    },
    integrations: {
        manage: [roles.ADMIN, roles.SOC_MANAGER, roles.PHISHING_MANAGER, roles.SOC_ANALYST, roles.INTEGRATION_ADMIN]
    }
};
