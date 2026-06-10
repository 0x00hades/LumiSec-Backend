export const successResponse = (res, { message, data, statusCode = 200 }) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

export const paginatedResponse = (res, { message, data, page, limit, total }) => {
    return res.status(200).json({
        success: true,
        message,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        data
    });
};
