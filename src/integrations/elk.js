import { Client } from "@elastic/elasticsearch";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

const client = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
    }
});

export const searchLogs = async ({ index = "logs-*", query, size = 100, from = 0 }) => {
    try {
        const result = await client.search({ index, body: { query, size, from } });
        return result.hits.hits.map(h => h._source);
    } catch (error) {
        throw new AppError(`${messages.integration.elkError}: ${error.message}`, 502);
    }
};

export const getRecentAlerts = async (minutes = 15) => {
    return searchLogs({
        index: "alerts-*",
        query: {
            bool: {
                filter: [{ range: { "@timestamp": { gte: `now-${minutes}m` } } }]
            }
        }
    });
};

export const indexDocument = async (index, document) => {
    return client.index({ index, body: document, refresh: true });
};
