/**
 * Framework import seed — run with: npm run seed:frameworks
 * Requires MONGO_URI in config/.env
 */
import dotenv from "dotenv";
import { connectDB } from "../connection.js";
import { importFrameworks } from "../../src/modules/grc/services/frameworkImporter.service.js";
import { logger } from "../../src/utils/logger.js";

dotenv.config({ path: "config/.env" });

const printSummary = (summary) => {
    console.log("\n========================================");
    console.log("  LumiSec Framework Import Complete");
    console.log("========================================");
    console.log(`Files Scanned:          ${summary.filesScanned}`);
    console.log(`Frameworks Imported:    ${summary.frameworks.imported} (total: ${summary.frameworks.total}, skipped: ${summary.frameworks.skipped})`);
    console.log(`Requirements Imported:  ${summary.requirements.imported} (total: ${summary.requirements.total}, skipped: ${summary.requirements.skipped})`);
    console.log(`Controls Imported:      ${summary.controls.imported} (total: ${summary.controls.total}, skipped: ${summary.controls.skipped})`);
    console.log(`Mappings Imported:      ${summary.mappings.imported} (skipped: ${summary.mappings.skipped})`);
    console.log("========================================\n");
};

const seed = async () => {
    await connectDB();

    const dryRun = process.argv.includes("--dry-run");
    const summary = await importFrameworks({ dryRun });

    if (dryRun) {
        console.log("\nDry run — no data written.");
        console.log(`Files Scanned:          ${summary.filesScanned}`);
        console.log(`Frameworks Detected:    ${summary.frameworksDetected}`);
        console.log(`Requirements Detected:  ${summary.requirementsDetected}`);
        console.log(`Controls Detected:      ${summary.controlsDetected}`);
        console.log("Frameworks:", summary.frameworks.join(", "));
    } else {
        printSummary(summary);
    }

    process.exit(0);
};

seed().catch((err) => {
    logger.error("Framework import failed", { message: err.message, stack: err.stack });
    console.error(err.message);
    process.exit(1);
});
