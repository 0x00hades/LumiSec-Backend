import nodemailer from "nodemailer";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
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
    // Inject tracking pixel and link rewriting
    const trackedHtml = htmlBody
        .replace(/href="([^"]+)"/g, `href="${trackingDomain}/track/click/${trackingId}?url=$1"`)
        + `<img src="${trackingDomain}/track/open/${trackingId}" width="1" height="1" style="display:none"/>`;

    return sendEmail({ to, subject, html: trackedHtml, from });
};
