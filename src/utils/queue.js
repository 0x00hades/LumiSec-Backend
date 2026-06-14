import Bull from "bull";
import Redis from "ioredis";

const isTest = process.env.NODE_ENV === "test";

const redisConfig = isTest
    ? {
        createClient: () => new Redis({
            host: "127.0.0.1",
            port: 6379,
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            lazyConnect: true,
            retryStrategy: () => null
        })
    }
    : { redis: process.env.REDIS_URL || "redis://localhost:6379" };
export const emailQueue      = new Bull("emailQueue",      redisConfig);
export const soarQueue          = new Bull("soarQueue",          redisConfig);
export const enrichmentQueue    = new Bull("enrichmentQueue",    redisConfig);
export const alertQueue         = new Bull("alertQueue",         redisConfig);
export const soarNotificationQueue = new Bull("soarNotificationQueue", redisConfig);
export const analyticsQueue     = new Bull("analyticsQueue",     redisConfig);
export const soarIntegrationQueue  = new Bull("soarIntegrationQueue", redisConfig);
export const ruleQueue       = new Bull("ruleQueue",       redisConfig);
export const reportQueue     = new Bull("reportQueue",     redisConfig);
export const trackingQueue   = new Bull("trackingQueue",   redisConfig);
export const riskQueue       = new Bull("riskQueue",       redisConfig);
