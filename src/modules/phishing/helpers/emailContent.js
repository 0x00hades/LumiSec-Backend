export function buildLandingUrl(trackingDomain, trackingId) {
    const base = (trackingDomain || "").replace(/\/$/, "");
    return `${base}/landing/${trackingId}`;
}

export function personalizeTemplate(html, recipient = {}) {
    if (!html) return html;

    const firstName = (recipient.fullName || "").trim().split(/\s+/)[0]
        || (recipient.email || "").split("@")[0]
        || "";

    const replacements = {
        firstName,
        fullName: recipient.fullName || "",
        email: recipient.email || "",
        department: recipient.department || "",
    };

    let out = html;
    for (const [key, value] of Object.entries(replacements)) {
        out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
    }
    return out;
}

export function prepareEmailHtml(htmlBody, recipient, landingUrl) {
    let html = personalizeTemplate(htmlBody, recipient);

    if (landingUrl) {
        html = html.replace(/\{\{\s*landing[_]?url\s*\}\}/gi, landingUrl);
        const hasLandingLink = /\/landing\//i.test(html)
            || html.includes(landingUrl);
        if (!hasLandingLink) {
            html += `<p style="margin-top:16px"><a href="${landingUrl}">Continue to secure login</a></p>`;
        }
    }

    return html;
}
