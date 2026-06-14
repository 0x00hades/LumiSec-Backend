const portTechniqueMap = {
    22: {
        title: "SSH Remote Services Exposure",
        technique: "T1021.004",
        tactic: "lateral-movement",
        reason: "SSH is exposed on this asset, which can be relevant for remote service monitoring."
    },
    23: {
        title: "Telnet Plaintext Remote Administration",
        technique: "T1021",
        tactic: "lateral-movement",
        reason: "Telnet was detected and should be monitored because it exposes plaintext remote administration."
    },
    445: {
        title: "SMB Lateral Movement Surface",
        technique: "T1021.002",
        tactic: "lateral-movement",
        reason: "SMB is open on this asset, which is commonly used during lateral movement."
    },
    3389: {
        title: "RDP Remote Services Exposure",
        technique: "T1021.001",
        tactic: "lateral-movement",
        reason: "RDP is open on this asset, which should be monitored for remote logon abuse."
    },
    5985: {
        title: "WinRM Remote Execution Surface",
        technique: "T1021.006",
        tactic: "lateral-movement",
        reason: "WinRM is open on this asset, which can support remote command execution."
    }
};

const misconfigurationTechniqueMap = {
    telnet_enabled: {
        title: "Telnet Service Detected",
        technique: "T1021",
        tactic: "lateral-movement",
        reason: "A LumiNet misconfiguration shows Telnet enabled on the asset."
    },
    smb_exposed: {
        title: "SMB Exposure Detection Context",
        technique: "T1021.002",
        tactic: "lateral-movement",
        reason: "A LumiNet misconfiguration shows SMB exposure that can increase lateral movement risk."
    }
};

/**
 * Chooses a Sigma logsource from LumiNet's best-known operating-system context.
 */
const buildLogsource = (asset) => {
    if (asset.osType === "windows") {
        return { product: "windows", category: "process_creation" };
    }
    if (asset.osType === "linux") {
        return { product: "linux", category: "process_creation" };
    }
    return { product: "network", category: "network_connection" };
};

/**
 * Builds a stable suggestion object that UCTC can display or use as a rule draft seed.
 */
const buildSuggestion = ({ title, technique, tactic, reason, asset, source }) => ({
    title: `${title} - ${asset.ip}`,
    description: `${reason} Asset ${asset.ip} (${asset.hostname || asset.mac}) came from LumiNet ${source} context.`,
    level: source === "flow_anomaly" ? "high" : "medium",
    tags: [`attack.${tactic}`, `attack.${technique.toLowerCase()}`],
    mitreTactics: [tactic],
    mitreTechniques: [technique],
    logsource: buildLogsource(asset),
    networkContext: {
        source,
        assetIp: asset.ip,
        assetMac: asset.mac,
        hostname: asset.hostname,
        osType: asset.osType,
        openPorts: asset.openPorts?.map((item) => item.port) || []
    }
});

/**
 * Converts LumiNet asset, misconfiguration, and flow context into UCTC rule suggestions.
 */
export const buildNetworkDetectionSuggestions = ({ asset, misconfigurations = [], recentFlows = [] }) => {
    const suggestions = [];
    const seenTechniques = new Set();

    const addSuggestion = (suggestion) => {
        const key = suggestion.mitreTechniques?.[0] || suggestion.title;
        if (seenTechniques.has(key)) return;
        seenTechniques.add(key);
        suggestions.push(suggestion);
    };

    for (const port of asset.openPorts || []) {
        const mapping = portTechniqueMap[port.port];
        if (!mapping) continue;
        addSuggestion(buildSuggestion({ ...mapping, asset, source: `open_port_${port.port}` }));
    }

    for (const misconfiguration of misconfigurations) {
        const mapping = misconfigurationTechniqueMap[misconfiguration.type];
        if (!mapping) continue;
        addSuggestion(buildSuggestion({ ...mapping, asset, source: `misconfiguration_${misconfiguration.type}` }));
    }

    if (recentFlows.some((flow) => flow.isAnomaly)) {
        addSuggestion(buildSuggestion({
            title: "Network Overflow or Exfiltration Anomaly",
            technique: "T1041",
            tactic: "exfiltration",
            reason: "LumiNet flow metrics show anomalous packet or bandwidth volume for this asset.",
            asset,
            source: "flow_anomaly"
        }));
    }

    if (!suggestions.length) {
        suggestions.push({
            title: `Review Network Context - ${asset.ip}`,
            description: "LumiNet has asset context, but no high-confidence rule mapping was found yet.",
            level: "low",
            tags: [],
            mitreTactics: [],
            mitreTechniques: [],
            logsource: buildLogsource(asset),
            networkContext: {
                source: "asset_context",
                assetIp: asset.ip,
                assetMac: asset.mac,
                hostname: asset.hostname,
                osType: asset.osType,
                openPorts: asset.openPorts?.map((item) => item.port) || []
            }
        });
    }

    return suggestions;
};
