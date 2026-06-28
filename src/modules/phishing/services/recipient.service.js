import { Recipient, Campaign } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { parsePagination } from "../../../utils/pagination.js";
import { generateTrackingId } from "../helpers/trackingId.js";
import { parseRecipientCsv } from "../helpers/csvParser.js";

export const importRecipients = async ({ csv, recipients, campaignId }) => {
    if (campaignId) {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    }

    const rows = csv ? parseRecipientCsv(csv) : recipients;
    if (!rows?.length) throw new AppError("No valid recipients to import", 422);

    const docs = rows.map((row) => ({
        campaignId: campaignId || undefined,
        fullName: row.fullName,
        email: row.email.toLowerCase(),
        department: row.department,
        jobTitle: row.jobTitle,
        manager: row.manager,
        trackingId: generateTrackingId()
    }));

    const created = await Recipient.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.insertedDocs?.length) return err.insertedDocs;
        throw err;
    });

    if (campaignId) {
        await Campaign.findByIdAndUpdate(campaignId, {
            $inc: { recipientsCount: created.length }
        });
    }

    return { imported: created.length, recipients: created };
};

export const listRecipients = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.campaignId) filter.campaignId = query.campaignId;
    if (query.email) filter.email = query.email.toLowerCase();

    const [data, total] = await Promise.all([
        Recipient.find(filter).sort(sort).skip(skip).limit(limit),
        Recipient.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getRecipientById = async (id) => {
    const recipient = await Recipient.findById(id);
    if (!recipient) throw new AppError(messages.recipient.notFound, 404);
    return recipient;
};

export const updateRecipient = async (id, updates) => {
    const recipient = await Recipient.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!recipient) throw new AppError(messages.recipient.notFound, 404);
    return recipient;
};

export const deleteRecipient = async (id) => {
    const recipient = await Recipient.findById(id);
    if (!recipient) throw new AppError(messages.recipient.notFound, 404);
    if (recipient.emailSent) {
        throw new AppError(messages.recipient.cannotDeleteAfterSent, 400);
    }

    await Recipient.findByIdAndDelete(id);

    if (recipient.campaignId) {
        await Campaign.findByIdAndUpdate(recipient.campaignId, { $inc: { recipientsCount: -1 } });
    }

    return recipient;
};

export const assignRecipientsToCampaign = async (campaignId, recipientIds) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const result = await Recipient.updateMany(
        { _id: { $in: recipientIds }, $or: [{ campaignId: { $exists: false } }, { campaignId: null }] },
        { $set: { campaignId } }
    );

    const count = await Recipient.countDocuments({ campaignId });
    campaign.recipientsCount = count;
    await campaign.save();

    return { assigned: result.modifiedCount, totalRecipients: count };
};
