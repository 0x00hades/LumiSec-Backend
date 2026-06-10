export const BUILT_IN_SCENARIOS = [
    {
        scenarioId: "APT29_Empire_C2",
        name: "APT29 Empire C2 Beacon Simulation",
        language: "powershell",
        mitreTechniques: ["T1059.001", "T1105"],
        description: "Safe PowerShell simulation that prints the telemetry shape of an encoded C2 beacon.",
        expectedSignals: ["powershell", "encoded_command", "c2_beacon"],
        script: `
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("whoami /all"))
Write-Output "SIMULATION_ONLY=true"
Write-Output "technique=T1059.001"
Write-Output "process=powershell.exe"
Write-Output "encoded_command=$encoded"
Write-Output "network_indicator=http://10.99.99.99:8080/index.php"
`
    },
    {
        scenarioId: "Lazarus_WMI_Ransomware",
        name: "Lazarus WMI Persistence Simulation",
        language: "powershell",
        mitreTechniques: ["T1047", "T1053"],
        description: "Safe PowerShell simulation that prints WMI and scheduled-task telemetry without changing the host.",
        expectedSignals: ["wmi", "scheduled_task", "ransomware_staging"],
        script: `
Write-Output "SIMULATION_ONLY=true"
Write-Output "technique=T1047"
Write-Output "wmi_class=Win32_Process"
Write-Output "scheduled_task=BackupHealthCheck"
Write-Output "ransomware_note=simulated_no_file_changes"
`
    },
    {
        scenarioId: "APT28_Mimikatz_LSASS",
        name: "APT28 LSASS Access Simulation",
        language: "python",
        mitreTechniques: ["T1003.001"],
        description: "Safe Python simulation that emits LSASS-access style telemetry for detection testing.",
        expectedSignals: ["lsass", "credential_access", "event_log"],
        script: `
import json
event = {
    "SIMULATION_ONLY": True,
    "technique": "T1003.001",
    "process": "python.exe",
    "target_process": "lsass.exe",
    "access_mask": "0x1410"
}
print(json.dumps(event))
`
    },
    {
        scenarioId: "Linux_Bash_Lateral_Movement",
        name: "Linux Bash Lateral Movement Simulation",
        language: "bash",
        mitreTechniques: ["T1021.004"],
        description: "Safe Bash simulation that emits SSH lateral-movement indicators without opening connections.",
        expectedSignals: ["ssh", "lateral_movement", "linux"],
        script: `
echo "SIMULATION_ONLY=true"
echo "technique=T1021.004"
echo "command=ssh user@10.0.0.20"
echo "result=not_executed"
`
    }
];

/**
 * Returns all built-in attack scenarios exposed to the UCTC lab.
 * Scripts are safe telemetry generators, not destructive attack code.
 */
export const listBuiltInScenarios = () => BUILT_IN_SCENARIOS.map(({ script, ...scenario }) => scenario);

/**
 * Looks up one built-in scenario by its stable ID.
 */
export const getBuiltInScenario = (scenarioId) => {
    return BUILT_IN_SCENARIOS.find((scenario) => scenario.scenarioId === scenarioId);
};
