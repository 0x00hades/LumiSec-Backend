import {
    Artifact, ArtifactEnrichment, Incident
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { entityType, auditAction } from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";
import { enrichmentQueue } from "../../../utils/queue.js";

export const createArtifact = async (data, user) => {
    const incident = await Incident.findById(data.incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    const artifact = await Artifact.create({
        ...data,
        value: data.value.trim(),
        createdBy: user._id
    });

    await auditCreate(user, entityType.ARTIFACT, artifact);
    return artifact;
};

export const listArtifacts = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.incidentId) filter.incidentId = query.incidentId;
    if (query.type) filter.type = query.type;

    const searchFilter = buildTextSearch(query.search, ["value", "label", "source"]);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    const [data, total] = await Promise.all([
        Artifact.find(finalFilter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("createdBy", "name email")
            .populate("incidentId", "title severity status"),
        Artifact.countDocuments(finalFilter)
    ]);

    return { data, page, limit, total };
};

export const listArtifactsByIncident = async (incidentId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    return Artifact.find({ incidentId })
        .sort({ createdAt: -1 })
        .populate("createdBy", "name email");
};

export const getArtifactById = async (id) => {
    const artifact = await Artifact.findById(id)
        .populate("incidentId", "title severity status")
        .populate("createdBy", "name email");

    if (!artifact) throw new AppError(messages.general.notFound, 404);

    const enrichments = await ArtifactEnrichment.find({ artifactId: id }).sort({ enrichedAt: -1 });
    return { artifact, enrichments };
};

export const updateArtifact = async (id, updates, user) => {
    const artifact = await Artifact.findById(id);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    const oldValue = artifact.toObject();
    if (updates.value) updates.value = updates.value.trim();
    Object.assign(artifact, updates);
    await artifact.save();

    await auditUpdate(user, entityType.ARTIFACT, artifact._id, oldValue, artifact.toObject());
    return artifact;
};

export const softDeleteArtifact = async (id, user) => {
    const artifact = await Artifact.findById(id);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    artifact.deletedAt = new Date();
    await artifact.save();

    await recordAudit({
        user,
        action: auditAction.DELETE,
        entityType: entityType.ARTIFACT,
        entityId: artifact._id,
        oldValue: artifact.toObject(),
        newValue: { deletedAt: artifact.deletedAt }
    });

    return artifact;
};

export const queueEnrichment = async (artifactId, providers = ["opencti"]) => {
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    const jobs = providers.map((provider) =>
        enrichmentQueue.add("processEnrichArtifact", {
            artifactId: artifact._id,
            incidentId: artifact.incidentId,
            type: artifact.type,
            value: artifact.value,
            provider
        }, { attempts: 3, backoff: { type: "exponential", delay: 2000 } })
    );

    await Promise.all(jobs);
    return { artifactId, queued: providers.length, providers };
};

export const enrichArtifact = async (artifactId, user, providers = ["opencti"]) => {
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    await queueEnrichment(artifactId, providers);

    await recordAudit({
        user,
        action: auditAction.ENRICH,
        entityType: entityType.ARTIFACT,
        entityId: artifact._id,
        newValue: { providers, queued: true }
    });

    return { artifactId, queued: true, providers };
};

export const enrichArtifactsBulk = async (artifactIds, user, providers = ["opencti"]) => {
    if (!artifactIds?.length) throw new AppError("No artifact IDs provided", 400);

    const artifacts = await Artifact.find({ _id: { $in: artifactIds } });
    if (!artifacts.length) throw new AppError(messages.general.notFound, 404);

    const results = await Promise.all(
        artifacts.map(async (artifact) => {
            await queueEnrichment(artifact._id, providers);
            return artifact._id;
        })
    );

    await recordAudit({
        user,
        action: auditAction.ENRICH,
        entityType: entityType.ARTIFACT,
        entityId: results[0],
        newValue: { bulk: true, artifactIds: results, providers }
    });

    return { queued: results.length, artifactIds: results };
};

export const saveEnrichmentResult = async (artifactId, { provider, data, confidence }) => {
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    const enrichment = await ArtifactEnrichment.create({
        artifactId,
        provider,
        data,
        confidence,
        enrichedAt: new Date()
    });

    return enrichment;
};

export const getEnrichmentHistory = async (artifactId) => {
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) throw new AppError(messages.general.notFound, 404);

    return ArtifactEnrichment.find({ artifactId }).sort({ enrichedAt: -1 });
};
