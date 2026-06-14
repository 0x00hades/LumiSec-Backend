import { EmailTemplate } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { parsePagination } from "../../../utils/pagination.js";

export const createTemplate = async (data, user) => {
    return EmailTemplate.create({ ...data, createdBy: user._id });
};

export const listTemplates = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.category) filter.category = query.category;

    const [data, total] = await Promise.all([
        EmailTemplate.find(filter).sort(sort).skip(skip).limit(limit).populate("createdBy", "name email"),
        EmailTemplate.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getTemplateById = async (id) => {
    const template = await EmailTemplate.findById(id).populate("createdBy", "name email");
    if (!template) throw new AppError(messages.template.notFound, 404);
    return template;
};

export const updateTemplate = async (id, updates) => {
    const template = await EmailTemplate.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!template) throw new AppError(messages.template.notFound, 404);
    return template;
};

export const deleteTemplate = async (id) => {
    const template = await EmailTemplate.findByIdAndDelete(id);
    if (!template) throw new AppError(messages.template.notFound, 404);
    return template;
};
