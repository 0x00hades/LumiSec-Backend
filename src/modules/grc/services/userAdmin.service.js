import bcrypt from "bcrypt";
import { User } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { userStatus } from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";

const publicFields = "name email role status department lastLogin createdAt updatedAt";

export const listUsers = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const searchFilter = buildTextSearch(query.search, ["name", "email", "department"]);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    const [data, total] = await Promise.all([
        User.find(finalFilter).select(publicFields).sort(sort).skip(skip).limit(limit),
        User.countDocuments(finalFilter)
    ]);

    return { data, page, limit, total };
};

export const createUser = async (payload) => {
    const existingUser = await User.findOne({ email: payload.email.toLowerCase() });
    if (existingUser) throw new AppError(messages.user.alreadyExists, 409);

    const hashedPassword = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: hashedPassword,
        role: payload.role,
        department: payload.department?.trim() || undefined,
        status: userStatus.ACTIVE
    });

    return User.findById(user._id).select(publicFields);
};

export const updateUser = async (id, updates, actor) => {
    const user = await User.findById(id);
    if (!user) throw new AppError(messages.user.notFound, 404);

    if (String(user._id) === String(actor._id) && updates.status && updates.status !== user.status) {
        throw new AppError("You cannot change your own account status", 400);
    }

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.department !== undefined) {
        user.department = updates.department.trim() || undefined;
    }

    await user.save();
    return User.findById(user._id).select(publicFields);
};
