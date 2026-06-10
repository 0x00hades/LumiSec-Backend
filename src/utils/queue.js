import Bull from "bull";

const redisConfig = { redis: process.env.REDIS_URL || "redis://localhost:6379" };

export const emailQueue   = new Bull("emailQueue",   redisConfig);
export const soarQueue    = new Bull("soarQueue",    redisConfig);
export const ruleQueue    = new Bull("ruleQueue",    redisConfig);
export const reportQueue  = new Bull("reportQueue",  redisConfig);
