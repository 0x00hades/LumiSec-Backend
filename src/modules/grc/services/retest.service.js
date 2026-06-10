import { Retest, Finding } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { findingStatus, retestResult, entityType, notificationType } from "../../../utils/constant/enums.js";
import { auditCreate } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";

export const createRetest = async (findingId, { result, notes }, user) => {
    const finding = await Finding.findById(findingId);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const retest = await Retest.create({
        findingId,
        result,
        notes,
        testedBy: user._id
    });

    if (result === retestResult.PASS) {
        finding.status = findingStatus.CLOSED;
        finding.closedBy = user._id;
        finding.closedAt = new Date();
    } else {
        finding.status = findingStatus.REOPENED;
        finding.closedAt = undefined;
        finding.closedBy = undefined;
    }
    await finding.save();

    await auditCreate(user, entityType.RETEST, retest);

    if (finding.assignedTo) {
        await createNotification({
            userId: finding.assignedTo,
            title: "Retest completed",
            message: `Finding "${finding.title}" retest result: ${result}`,
            type: notificationType.RETEST,
            entityType: entityType.FINDING,
            entityId: finding._id
        });
    }

    return { retest, finding };
};

export const listRetests = async (findingId) => {
    const finding = await Finding.findById(findingId);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    return Retest.find({ findingId })
        .sort({ testedAt: -1 })
        .populate("testedBy", "name email");
};
