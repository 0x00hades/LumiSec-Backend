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
        deployedSuccessfully: "Rule deployed to SIEM successfully",
        retiredSuccessfully: "Rule retired successfully",
        conversionFailed: "Rule conversion failed",
        invalidSyntax: "Invalid Sigma rule syntax"
    },
    finding: {
        notFound: "Finding not found",
        createdSuccessfully: "Finding created successfully",
        updatedSuccessfully: "Finding updated successfully",
        deletedSuccessfully: "Finding deleted successfully",
        assignedSuccessfully: "Finding assigned successfully",
        closedSuccessfully: "Finding closed successfully",
        reopenedSuccessfully: "Finding reopened — re-test required",
        cannotClose: "Finding cannot be closed without passing all validation gates",
        historyFetched: "Finding history fetched"
    },
    risk: {
        notFound: "Risk not found",
        createdSuccessfully: "Risk created successfully",
        updatedSuccessfully: "Risk updated successfully",
        acceptedSuccessfully: "Risk accepted successfully",
        mitigatedSuccessfully: "Risk mitigated successfully",
        closedSuccessfully: "Risk closed successfully"
    },
    task: {
        notFound: "Remediation task not found",
        createdSuccessfully: "Remediation task created successfully",
        updatedSuccessfully: "Remediation task updated successfully",
        completedSuccessfully: "Remediation task completed successfully",
        verifiedSuccessfully: "Remediation task verified successfully",
        cannotVerify: "Task must be completed before verification"
    },
    evidence: {
        notFound: "Evidence not found",
        uploadedSuccessfully: "Evidence uploaded successfully",
        deletedSuccessfully: "Evidence deleted successfully"
    },
    report: {
        notFound: "Audit report not found",
        createdSuccessfully: "Audit report created successfully",
        updatedSuccessfully: "Audit report updated successfully",
        deletedSuccessfully: "Audit report deleted successfully",
        generateQueued: "Report PDF generation queued",
        pdfNotReady: "Report PDF is not ready for download"
    },
    compliance: {
        notFound: "Compliance control not found",
        createdSuccessfully: "Compliance control created successfully",
        updatedSuccessfully: "Compliance control updated successfully",
        linkedSuccessfully: "Finding linked to control successfully"
    },
    retest: {
        createdSuccessfully: "Retest recorded successfully",
        listFetched: "Retest history fetched"
    },
    notification: {
        notFound: "Notification not found",
        markedRead: "Notification marked as read"
    },
    integration: {
        elkError: "Failed to connect to ELK Stack",
        openctiError: "Failed to fetch from OpenCTI",
        firewallError: "Firewall action failed",
        vmError: "Could not connect to VM",
        smtpError: "Failed to send email",
        ingestedSuccessfully: "Integration data ingested successfully"
    },
    general: {
        notFound: "Resource not found",
        serverError: "Internal server error",
        validationError: "Validation failed",
        routeNotFound: "Route not found"
    }
};
