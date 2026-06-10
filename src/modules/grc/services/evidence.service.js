import fs from "fs";
import { Evidence } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { entityType } from "../../../utils/constant/enums.js";
import { auditCreate, auditDelete } from "../../../utils/auditLogger.js";

export const createEvidence = async ({ findingId, taskId, file, user }) => {
    const evidence = await Evidence.create({
        findingId,
        taskId: taskId || undefined,
        filename: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user._id
    });

    await auditCreate(user, entityType.EVIDENCE, evidence);
    return evidence;
};

export const getEvidenceById = async (id) => {
    const evidence = await Evidence.findById(id).populate("uploadedBy", "name email");
    if (!evidence) throw new AppError(messages.evidence.notFound, 404);
    return evidence;
};

export const deleteEvidence = async (id, user) => {
    const evidence = await Evidence.findById(id);
    if (!evidence) throw new AppError(messages.evidence.notFound, 404);

    if (fs.existsSync(evidence.filePath)) fs.unlinkSync(evidence.filePath);

    await auditDelete(user, entityType.EVIDENCE, evidence);
    await Evidence.findByIdAndDelete(id);
    return evidence;
};
