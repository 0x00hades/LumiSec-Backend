import { Notification } from "../../database/index.js";
import { emitAlert } from "./socket.js";

export const createNotification = async ({ userId, title, message, type, entityType, entityId }) => {
    const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        entityType,
        entityId
    });

    emitAlert(`user:${userId}`, "grc:notification", {
        id: notification._id,
        title,
        message,
        type,
        entityType,
        entityId
    });

    return notification;
};

export const notifyUsers = async (userIds, payload) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
    return Promise.all(uniqueIds.map((userId) => createNotification({ ...payload, userId })));
};
