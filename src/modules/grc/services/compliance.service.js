import { ComplianceControl } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { entityType, auditAction } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";

export const createControl = async (data, user) => {
    const { controlId, title, framework, description, status } = data;

    if (!controlId?.trim?.() || !title?.trim?.()) {
        const err = new Error("controlId and title are required fields");
        err.statusCode = 400;
        throw err;
    }

    const control = await ComplianceControl.create({
        framework,
        controlId: controlId.trim(),
        title: title.trim(),
        description,
        status
    });
    await auditCreate(user, entityType.CONTROL, control);
    return control;
};

export const listControls = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.framework) filter.framework = query.framework;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
        ComplianceControl.find(filter).sort(sort).skip(skip).limit(limit).populate("linkedFindings", "title status severity"),
        ComplianceControl.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getControlById = async (id) => {
    const control = await ComplianceControl.findById(id).populate("linkedFindings", "title status severity riskRating");
    if (!control) throw new AppError(messages.compliance.notFound, 404);
    return control;
};

export const updateControl = async (id, updates, user) => {
    const control = await ComplianceControl.findById(id);
    if (!control) throw new AppError(messages.compliance.notFound, 404);

    const oldValue = control.toObject();
    Object.assign(control, updates);
    await control.save();

    await auditUpdate(user, entityType.CONTROL, control._id, oldValue, control.toObject());
    return control;
};

export const linkFindingToControl = async (id, findingId, user) => {
    const control = await ComplianceControl.findById(id);
    if (!control) throw new AppError(messages.compliance.notFound, 404);

    const oldValue = { linkedFindings: control.linkedFindings };
    if (!control.linkedFindings.map(String).includes(String(findingId))) {
        control.linkedFindings.push(findingId);
        await control.save();
    }

    await recordAudit({
        user,
        action: auditAction.LINK,
        entityType: entityType.CONTROL,
        entityId: control._id,
        oldValue,
        newValue: { linkedFindings: control.linkedFindings }
    });

    return control;
};

export const getComplianceStatus = async () => {
    const pipeline = [
        {
            $group: {
                _id: { framework: "$framework", status: "$status" },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.framework",
                statuses: {
                    $push: { status: "$_id.status", count: "$count" }
                },
                total: { $sum: "$count" }
            }
        }
    ];

    const byFramework = await ComplianceControl.aggregate(pipeline);

    const overall = await ComplianceControl.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    return { byFramework, overall };
};
