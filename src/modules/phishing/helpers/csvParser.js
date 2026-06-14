export const parseRecipientCsv = (csvText) => {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const emailIdx = header.indexOf("email");
    const deptIdx = header.indexOf("department");

    if (emailIdx === -1) {
        throw new Error("CSV must include an email column");
    }

    return lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
            fullName: nameIdx >= 0 ? cols[nameIdx] : undefined,
            email: cols[emailIdx],
            department: deptIdx >= 0 ? cols[deptIdx] : undefined
        };
    }).filter((r) => r.email);
};
