import { Notification } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { parsePagination } from "../../../utils/pagination.js";

export const listNotifications = async (userId, query) => {
    const { page, limit, skip } = parsePagination(query);
    const filter = { userId };
    if (query.isRead !== undefined) filter.isRead = query.isRead === "true";

    const [data, total] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const markNotificationRead = async (id, userId) => {
    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) throw new AppError(messages.notification.notFound, 404);

    notification.isRead = true;
    await notification.save();
    return notification;
};
