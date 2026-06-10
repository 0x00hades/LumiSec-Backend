export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
    const skip = (page - 1) * limit;
    const sort = query.sort || "-createdAt";
    return { page, limit, skip, sort };
};

export const buildTextSearch = (search, fields = []) => {
    if (!search || !fields.length) return {};
    return { $or: fields.map((field) => ({ [field]: { $regex: search, $options: "i" } })) };
};
