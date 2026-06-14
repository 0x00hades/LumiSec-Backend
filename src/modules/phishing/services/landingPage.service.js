import { LandingPage } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { parsePagination } from "../../../utils/pagination.js";

export const createLandingPage = async (data, user) => {
    return LandingPage.create({ ...data, createdBy: user._id });
};

export const listLandingPages = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);

    const [data, total] = await Promise.all([
        LandingPage.find().sort(sort).skip(skip).limit(limit).populate("createdBy", "name email"),
        LandingPage.countDocuments()
    ]);

    return { data, page, limit, total };
};

export const getLandingPageById = async (id) => {
    const page = await LandingPage.findById(id).populate("createdBy", "name email");
    if (!page) throw new AppError(messages.landingPage.notFound, 404);
    return page;
};

export const updateLandingPage = async (id, updates) => {
    const page = await LandingPage.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!page) throw new AppError(messages.landingPage.notFound, 404);
    return page;
};

export const deleteLandingPage = async (id) => {
    const page = await LandingPage.findByIdAndDelete(id);
    if (!page) throw new AppError(messages.landingPage.notFound, 404);
    return page;
};
