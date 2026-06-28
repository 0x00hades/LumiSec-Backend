import nodemailer from "nodemailer";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";
import { resolveTrackingBaseSync } from "../modules/phishing/helpers/trackingDomain.js";
import { injectOpenTrackingPixels } from "../modules/phishing/helpers/openTrackingPixel.js";

let transporter;

function getTransporter() {
    if (!transporter) {
        const smtpPort = Number(process.env.SMTP_PORT) || 587;
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
            tls: {
                rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false"
            }
        });
    }
    return transporter;
}

export const sendEmail = async ({ to, subject, html, from }) => {
    try {
        const info = await getTransporter().sendMail({
            from: from || process.env.SMTP_FROM,
            to,
            subject,
            html
        });
        return { messageId: info.messageId, accepted: info.accepted };
    } catch (error) {
        throw new AppError(`${messages.integration.smtpError}: ${error.message}`, 502);
    }
};

function wrapLinksForTracking(htmlBody, base, trackingId) {
    const wrap = (match, url) => {
        if (/^mailto:/i.test(url) || /^#/i.test(url)) return match;
        if (url.includes("/track/click/") || url.includes("/track/open/")) return match;
        const encoded = encodeURIComponent(url);
        return `href="${base}/track/click/${trackingId}?url=${encoded}"`;
    };

    return htmlBody
        .replace(/href="([^"]+)"/g, wrap)
        .replace(/href='([^']+)'/g, (match, url) => {
            const wrapped = wrap(`href="${url}"`, url);
            return wrapped.replace(/^href="/, "href='").replace(/"$/, "'");
        });
}

export const sendPhishingEmail = async ({ to, subject, htmlBody, from, trackingId, trackingDomain }) => {
    const base = resolveTrackingBaseSync(trackingDomain);
    const openPixelUrl = `${base}/track/open/${trackingId}?t=${Date.now()}`;

    let trackedHtml = wrapLinksForTracking(htmlBody, base, trackingId);
    trackedHtml = injectOpenTrackingPixels(trackedHtml, openPixelUrl);

    return sendEmail({ to, subject, html: trackedHtml, from });
};
