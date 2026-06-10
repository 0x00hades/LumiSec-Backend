export const messages = {
    auth: {
        loginSuccess: "Logged in successfully",
        logoutSuccess: "Logged out successfully",
        invalidCredentials: "Invalid email or password",
        notAuthenticated: "Authentication required",
        notAuthorized: "You are not authorized to perform this action",
        tokenExpired: "Session expired, please login again",
        accountSuspended: "Your account has been suspended"
    },
    user: {
        notFound: "User not found",
        createdSuccessfully: "User created successfully",
        updatedSuccessfully: "User updated successfully",
        deletedSuccessfully: "User deleted successfully",
        alreadyExists: "Email already in use"
    },
    incident: {
        notFound: "Incident not found",
        createdSuccessfully: "Incident created successfully",
        updatedSuccessfully: "Incident updated successfully",
        closedSuccessfully: "Incident closed successfully",
        alreadyClosed: "Incident is already closed"
    },
    playbook: {
        notFound: "Playbook not found",
        createdSuccessfully: "Playbook created successfully",
        executedSuccessfully: "Playbook executed successfully",
        updatedSuccessfully: "Playbook updated successfully",
        deletedSuccessfully: "Playbook deleted successfully"
    },
    campaign: {
        notFound: "Campaign not found",
        createdSuccessfully: "Campaign created successfully",
        launchedSuccessfully: "Campaign launched successfully",
        updatedSuccessfully: "Campaign updated successfully",
        deletedSuccessfully: "Campaign deleted successfully"
    },
    sigmaRule: {
        notFound: "Sigma rule not found",
        createdSuccessfully: "Rule created successfully",
        updatedSuccessfully: "Rule updated successfully",
        deployedSuccessfully: "Rule deployed to SIEM successfully",
        retiredSuccessfully: "Rule retired successfully",
        conversionFailed: "Rule conversion failed",
        invalidSyntax: "Invalid Sigma rule syntax"
    },
    finding: {
        notFound: "Finding not found",
        createdSuccessfully: "Finding created successfully",
        closedSuccessfully: "Finding closed successfully",
        reopenedSuccessfully: "Finding reopened — re-test required",
        cannotClose: "Finding cannot be closed without passing all validation gates"
    },
    integration: {
        elkError: "Failed to connect to ELK Stack",
        openctiError: "Failed to fetch from OpenCTI",
        firewallError: "Firewall action failed",
        vmError: "Could not connect to VM",
        smtpError: "Failed to send email"
    },
    general: {
        notFound: "Resource not found",
        serverError: "Internal server error",
        validationError: "Validation failed",
        routeNotFound: "Route not found"
    }
};
