import axios from "axios";
import axiosRetry from "axios-retry";

const baseURL = process.env.INTERNAL_API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const client = axios.create({
    baseURL,
    timeout: Number(process.env.INTEGRATION_TIMEOUT_MS) || 15000,
    headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": process.env.INTERNAL_API_KEY || ""
    }
});

axiosRetry(client, {
    retries: Number(process.env.INTEGRATION_RETRY_COUNT) || 2,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        const status = error.response?.status;
        return !status || status >= 500;
    }
});

export const postIntegration = async (path, payload) => {
    const response = await client.post(path, payload);
    return response.data;
};

export const patchIntegration = async (path, payload) => {
    const response = await client.patch(path, payload);
    return response.data;
};

export const getIntegration = async (path, params = {}) => {
    const response = await client.get(path, { params });
    return response.data;
};
