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
const PREFIX = process.env.QUEUE_PREFIX || "lumisec";

const queueName = (name) => `${PREFIX}.${name}`;

export const emailQueue      = new Bull(queueName("phishing.email"),      redisConfig);
export const soarQueue          = new Bull(queueName("soar.legacy"),          redisConfig);
export const enrichmentQueue    = new Bull(queueName("soar.enrichment"),    redisConfig);
export const alertQueue         = new Bull(queueName("soar.alert"),         redisConfig);
export const soarNotificationQueue = new Bull(queueName("soar.notification"), redisConfig);
export const analyticsQueue     = new Bull(queueName("soar.analytics"),     redisConfig);
export const soarIntegrationQueue  = new Bull(queueName("soar.integration"), redisConfig);
export const ruleQueue       = new Bull(queueName("uctc.rule"),       redisConfig);
export const reportQueue     = new Bull(queueName("report"),     redisConfig);
export const trackingQueue   = new Bull(queueName("phishing.tracking"),   redisConfig);
export const riskQueue       = new Bull(queueName("phishing.risk"),       redisConfig);
