import { Notification } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { notificationType, entityType } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";

const SOAR_NOTIFICATION_TYPES = [
    notificationType.INCIDENT,
    notificationType.PLAYBOOK,
    notificationType.INTEGRATION
];

const SOAR_ENTITY_TYPES = [
    entityType.INCIDENT,
    entityType.PLAYBOOK,
    entityType.PLAYBOOK_RUN,
    entityType.ARTIFACT,
    entityType.CONNECTOR,
    entityType.SOAR_ALERT,
    entityType.INTEGRATION_ACTION
];

export const listSoarNotifications = async (userId, query) => {
    const { page, limit, skip } = parsePagination(query);

    const filter = {
        userId,
        $or: [
            { type: { $in: SOAR_NOTIFICATION_TYPES } },
            { entityType: { $in: SOAR_ENTITY_TYPES } }
        ]
    };

    if (query.isRead !== undefined) filter.isRead = query.isRead === "true";
    if (query.type) filter.type = query.type;

    const [data, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, isRead: false })
    ]);

    return { data, page, limit, total, unreadCount };
};

export const markNotificationRead = async (id, userId) => {
    const notification = await Notification.findOne({
        _id: id,
        userId,
        $or: [
            { type: { $in: SOAR_NOTIFICATION_TYPES } },
            { entityType: { $in: SOAR_ENTITY_TYPES } }
        ]
    });

    if (!notification) throw new AppError(messages.notification.notFound, 404);

    notification.isRead = true;
    await notification.save();
    return notification;
};

export const markAllNotificationsRead = async (userId) => {
    const result = await Notification.updateMany(
        {
            userId,
            isRead: false,
            $or: [
                { type: { $in: SOAR_NOTIFICATION_TYPES } },
                { entityType: { $in: SOAR_ENTITY_TYPES } }
            ]
        },
        { isRead: true }
    );

    return { modified: result.modifiedCount };
};

export const getUnreadCount = async (userId) => {
    const count = await Notification.countDocuments({
        userId,
        isRead: false,
        $or: [
            { type: { $in: SOAR_NOTIFICATION_TYPES } },
            { entityType: { $in: SOAR_ENTITY_TYPES } }
        ]
    });

    return { unreadCount: count };
};
