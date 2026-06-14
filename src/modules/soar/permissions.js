import { roles } from "../../utils/constant/enums.js";

const allRead = [roles.ADMIN, roles.SOC_MANAGER, roles.SENIOR_ANALYST, roles.SOC_ANALYST, roles.INTEGRATION_ADMIN, roles.READ_ONLY];
const analysts = [roles.ADMIN, roles.SOC_MANAGER, roles.SENIOR_ANALYST, roles.SOC_ANALYST];
const managers = [roles.ADMIN, roles.SOC_MANAGER, roles.SENIOR_ANALYST];
const admins = [roles.ADMIN, roles.SOC_MANAGER];
const integration = [roles.ADMIN, roles.INTEGRATION_ADMIN, roles.SOC_MANAGER];

export const soarPermissions = {
    incidents: { create: analysts, read: allRead, update: analysts, delete: admins },
    notes: { create: analysts, read: allRead },
    artifacts: { create: analysts, read: allRead, enrich: analysts },
    playbooks: { create: managers, read: allRead, update: managers, delete: admins, execute: analysts },
    playbookRuns: { read: allRead, control: managers },
    webhooks: { ingest: integration },
    connectors: { create: integration, read: allRead, update: integration, delete: admins, test: integration },
    vault: { create: admins, read: admins, update: admins, delete: admins },
    analytics: { read: allRead, export: managers },
    notifications: { read: allRead, update: allRead },
    dashboard: { read: allRead },
    integrations: { execute: integration }
};
