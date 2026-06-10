import { SigmaRule } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import { ruleQueue } from "../../utils/queue.js";
import { ruleStatus } from "../../utils/constant/enums.js";

export const createRule = async (req, res, next) => {
    const { title, description, rawSigma, targetSiem, mitreTactics, mitreTechniques } = req.body;
    const createdBy = req.authUser._id;

    const rule = await SigmaRule.create({
        title, description, rawSigma, targetSiem, mitreTactics, mitreTechniques, createdBy
    });

    // Queue async conversion
    await ruleQueue.add("convertSigmaRule", { ruleId: rule._id, rawSigma, targetSiem });

    return successResponse(res, { message: messages.sigmaRule.createdSuccessfully, data: rule, statusCode: 201 });
};

export const deployRule = async (req, res, next) => {
    const { ruleId } = req.params;

    const rule = await SigmaRule.findById(ruleId);
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));
    if (rule.status !== ruleStatus.CONVERTED) {
        return next(new AppError("Rule must be converted before deployment", 400));
    }

    // TODO: Push convertedQuery to SIEM via ELK/Splunk/Sentinel API
    rule.status = ruleStatus.DEPLOYED;
    rule.deployedAt = new Date();
    rule.approvedBy = req.authUser._id;
    await rule.save();

    return successResponse(res, { message: messages.sigmaRule.deployedSuccessfully, data: rule });
};

export const getRules = async (req, res, next) => {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) filter.status = status;

    const [rules, total] = await Promise.all([
        SigmaRule.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate("createdBy", "name"),
        SigmaRule.countDocuments(filter)
    ]);

    return paginatedResponse(res, { message: "Rules fetched", data: rules, page: Number(page), limit: Number(limit), total });
};
