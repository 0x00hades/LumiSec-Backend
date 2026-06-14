import dotenv from "dotenv";
import { enrichmentQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { enrichIP } from "../integrations/opencti.js";
import { artifactType } from "../utils/constant/enums.js";
import * as artifactService from "../modules/soar/services/artifact.service.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 2 };

const enrichByProvider = async ({ type, value, provider }) => {
    switch (provider) {
        case "opencti":
            if (type === artifactType.IP) {
                return enrichIP(value);
            }
            return { provider, type, value, note: "OpenCTI enrichment available for IP artifacts only" };
        case "virustotal":
        case "shodan":
        case "custom":
            return { provider, type, value, enriched: true, source: provider };
        default:
            return { provider, type, value, note: "Unknown provider" };
    }
};

enrichmentQueue.process("processEnrichArtifact", PROCESS_OPTS.concurrency, async (job) => {
    const { artifactId, type, value, provider = "opencti" } = job.data;

    logger.info(`Enriching artifact ${artifactId} via ${provider}`);

    const data = await enrichByProvider({ type, value, provider });
    const confidence = data?.stixCyberObservables ? 0.8 : 0.5;

    const enrichment = await artifactService.saveEnrichmentResult(artifactId, {
        provider,
        data,
        confidence
    });

    logger.info(`Artifact ${artifactId} enriched by ${provider}`);
    return { artifactId, enrichmentId: enrichment._id, provider };
});

enrichmentQueue.process("enrichArtifact", PROCESS_OPTS.concurrency, async (job) => {
    logger.info(`Processing legacy enrichArtifact job for ${job.data.artifactId}`);
    const { artifactId, type, value, provider = "opencti" } = job.data;
    const data = await enrichByProvider({ type, value, provider });
    const enrichment = await artifactService.saveEnrichmentResult(artifactId, {
        provider,
        data,
        confidence: data?.stixCyberObservables ? 0.8 : 0.5
    });
    return { artifactId, enrichmentId: enrichment._id, provider };
});

logger.info("Enrichment worker started");
