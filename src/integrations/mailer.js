import nodemailer from "nodemailer";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

const smtpPort = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
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

export const sendEmail = async ({ to, subject, html, from }) => {
    try {
        const info = await transporter.sendMail({
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

export const sendPhishingEmail = async ({ to, subject, htmlBody, from, trackingId, trackingDomain }) => {
    const base = (trackingDomain || process.env.PHISHING_TRACKING_DOMAIN || "http://localhost:3000/api/phishing").replace(/\/$/, "");

    const trackedHtml = htmlBody
        .replace(/href="([^"]+)"/g, `href="${base}/track/click/${trackingId}?url=$1"`)
        + `<img src="${base}/track/open/${trackingId}" width="1" height="1" style="display:none"/>`;

    return sendEmail({ to, subject, html: trackedHtml, from });
};
