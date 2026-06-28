import dotenv from "dotenv";
dotenv.config({ path: "./config/.env" });

import { connectDB } from "../database/connection.js";
import { Campaign, Recipient } from "../database/index.js";
import { emailQueue } from "../src/utils/queue.js";
import { buildLandingUrl, prepareEmailHtml } from "../src/modules/phishing/helpers/emailContent.js";
import { getFromAddress } from "../src/modules/phishing/services/settings.service.js";
import { resolveTrackingBaseSync } from "../src/modules/phishing/helpers/trackingDomain.js";

const campaignId = process.argv[2];
if (!campaignId) {
    console.error("Usage: node scripts/requeue-campaign-emails.mjs <campaignId>");
    process.exit(1);
}

await connectDB();

const campaign = await Campaign.findById(campaignId)
    .populate("templateId")
    .populate("landingPageId");

if (!campaign) {
    console.error("Campaign not found");
    process.exit(1);
}

const recipients = await Recipient.find({ campaignId, emailSent: false });
if (!recipients.length) {
    console.log("No unsent recipients.");
    process.exit(0);
}

const domain = resolveTrackingBaseSync(campaign.trackingDomain);
const hasLandingPage = Boolean(campaign.landingPageId);
const fromAddress = await getFromAddress();

for (const recipient of recipients) {
    const landingUrl = hasLandingPage ? buildLandingUrl(domain, recipient.trackingId) : null;
    const htmlBody = prepareEmailHtml(campaign.templateId.htmlBody, recipient, landingUrl);

    await emailQueue.add(
        "sendPhishingEmail",
        {
            recipientId: recipient._id,
            campaignId,
            to: recipient.email,
            subject: campaign.templateId.subject,
            htmlBody,
            from: fromAddress,
            trackingId: recipient.trackingId,
            trackingDomain: domain
        },
        { jobId: `phishing-email-${recipient._id}` }
    );
    console.log("Queued:", recipient.email);
}

console.log(`Requeued ${recipients.length} email(s) for campaign "${campaign.name}"`);
process.exit(0);
