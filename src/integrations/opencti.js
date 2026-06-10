import axios from "axios";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

const gql = async (query, variables = {}) => {
    try {
        const response = await axios.post(
            `${process.env.OPENCTI_URL}/graphql`,
            { query, variables },
            { headers: { Authorization: `Bearer ${process.env.OPENCTI_TOKEN}`, "Content-Type": "application/json" } }
        );
        return response.data.data;
    } catch (error) {
        throw new AppError(`${messages.integration.openctiError}: ${error.message}`, 502);
    }
};

export const enrichIP = async (ip) => {
    const query = `
        query EnrichIP($value: String!) {
            stixCyberObservables(filters: [{ key: "value", values: [$value] }]) {
                edges {
                    node { id entity_type ... on IPv4Addr { value }
                        indicators { edges { node { name confidence } } }
                    }
                }
            }
        }
    `;
    return gql(query, { value: ip });
};

export const getIOCs = async (limit = 50) => {
    const query = `
        query GetIOCs($first: Int) {
            indicators(first: $first, orderBy: created_at, orderMode: desc) {
                edges { node { id name pattern confidence valid_until } }
            }
        }
    `;
    return gql(query, { first: limit });
};
