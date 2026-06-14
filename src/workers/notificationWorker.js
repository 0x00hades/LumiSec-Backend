import dotenv from "dotenv";
import { soarNotificationQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { createNotification, notifyUsers } from "../utils/notificationHelper.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 4 };

soarNotificationQueue.process("sendSoarNotification", PROCESS_OPTS.concurrency, async (job) => {
    const { userId, userIds, title, message, type, entityType, entityId } = job.data;

    if (userIds?.length) {
        const notifications = await notifyUsers(userIds, {
            title,
            message,
            type,
            entityType,
            entityId
        });
        logger.info(`SOAR notifications sent to ${userIds.length} users`);
        return { delivered: notifications.length };
    }

    if (!userId) throw new Error("userId or userIds required for SOAR notification");

    const notification = await createNotification({
        userId,
        title,
        message,
        type,
        entityType,
        entityId
    });

    logger.info(`SOAR notification delivered to user ${userId}`);
    return { notificationId: notification._id };
});

logger.info("SOAR notification worker started");
