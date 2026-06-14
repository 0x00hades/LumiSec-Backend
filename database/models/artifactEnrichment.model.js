import { model, Schema } from "mongoose";

const artifactEnrichmentSchema = new Schema({
    artifactId: { type: Schema.Types.ObjectId, ref: "Artifact", required: true },
    provider: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed },
    confidence: { type: Number, min: 0, max: 100 },
    enrichedAt: { type: Date, default: Date.now }
}, { timestamps: true });

artifactEnrichmentSchema.index({ artifactId: 1, enrichedAt: -1 });

export const ArtifactEnrichment = model("ArtifactEnrichment", artifactEnrichmentSchema);
