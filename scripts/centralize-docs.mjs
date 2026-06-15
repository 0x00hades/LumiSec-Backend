import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "lumisec-docs", "helping_docs");
const MARKDOWN_DIR = path.join(TARGET, "markdown");
const POSTMAN_COLLECTIONS = path.join(TARGET, "postman", "collections");
const POSTMAN_ENVIRONMENTS = path.join(TARGET, "postman", "environments");

const SKIP_DIRS = new Set(["node_modules", ".git", "helping_docs"]);

const isPostmanCollection = (filePath, content) => {
    const base = path.basename(filePath).toLowerCase();
    if (base.includes("postman") && base.endsWith(".json")) return true;
    if (base.endsWith(".postman_collection.json")) return true;
    if (base.endsWith(".postman_environment.json")) return true;
    try {
        const parsed = JSON.parse(content);
        if (parsed?.info?.schema?.includes("postman")) return true;
        if (parsed?._postman_id) return true;
        if (parsed?.info?._postman_id) return true;
    } catch {
        return false;
    }
    return false;
};

const isPostmanEnvironment = (filePath) => {
    const base = path.basename(filePath).toLowerCase();
    return base.endsWith(".postman_environment.json") || (base.includes("postman") && base.includes("environment"));
};

const walk = (dir, results = { md: [], postman: [] }) => {
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;

        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full).replace(/\\/g, "/");

        if (entry.isDirectory()) {
            if (full.startsWith(TARGET)) continue;
            walk(full, results);
            continue;
        }

        if (entry.name.endsWith(".md")) {
            results.md.push({ full, rel });
            continue;
        }

        if (entry.name.endsWith(".json")) {
            const content = fs.readFileSync(full, "utf8");
            if (isPostmanCollection(full, content)) {
                results.postman.push({ full, rel, kind: isPostmanEnvironment(full) ? "environment" : "collection" });
            }
        }
    }

    return results;
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const resolveTargetName = (destDir, originalName, sourceFull) => {
    const sourceRel = path.relative(ROOT, sourceFull).replace(/\\/g, "/");
    const sourceFolder = path.basename(path.dirname(sourceRel)).replace(/[^a-zA-Z0-9_-]/g, "_") || "root";
    const ext = path.extname(originalName);
    const stem = path.basename(originalName, ext);

    let candidate = originalName;
    let dest = path.join(destDir, candidate);

    while (fs.existsSync(dest)) {
        const existing = fs.statSync(dest);
        const incoming = fs.statSync(sourceFull);
        if (existing.size === incoming.size) {
            return { dest, candidate, duplicateSameSize: true };
        }
        candidate = `${stem}_from_${sourceFolder}${ext}`;
        dest = path.join(destDir, candidate);
        let n = 2;
        while (fs.existsSync(dest)) {
            candidate = `${stem}_from_${sourceFolder}_${n}${ext}`;
            dest = path.join(destDir, candidate);
            n += 1;
        }
    }

    return { dest, candidate, duplicateSameSize: false };
};

const moved = [];
const duplicateFlags = [];
const sourceDirs = new Set();

ensureDir(MARKDOWN_DIR);
ensureDir(POSTMAN_COLLECTIONS);
ensureDir(POSTMAN_ENVIRONMENTS);

const { md, postman } = walk(ROOT);

for (const file of md) {
    const originalName = path.basename(file.full);
    const { dest, candidate, duplicateSameSize } = resolveTargetName(MARKDOWN_DIR, originalName, file.full);
    fs.renameSync(file.full, dest);
    sourceDirs.add(path.dirname(file.rel));
    const entry = {
        filename: candidate,
        type: "markdown",
        originalPath: file.rel,
        newPath: path.relative(ROOT, dest).replace(/\\/g, "/"),
        sizeBytes: fs.statSync(dest).size
    };
    moved.push(entry);
    if (duplicateSameSize) duplicateFlags.push({ ...entry, reason: "same name and size as existing file" });
}

for (const file of postman) {
    const destDir = file.kind === "environment" ? POSTMAN_ENVIRONMENTS : POSTMAN_COLLECTIONS;
    const originalName = path.basename(file.full);
    const { dest, candidate, duplicateSameSize } = resolveTargetName(destDir, originalName, file.full);
    fs.renameSync(file.full, dest);
    sourceDirs.add(path.dirname(file.rel));
    const entry = {
        filename: candidate,
        type: file.kind === "environment" ? "postman_environment" : "postman_collection",
        originalPath: file.rel,
        newPath: path.relative(ROOT, dest).replace(/\\/g, "/"),
        sizeBytes: fs.statSync(dest).size
    };
    moved.push(entry);
    if (duplicateSameSize) duplicateFlags.push({ ...entry, reason: "same name and size as existing file" });
}

const summary = {
    generatedAt: new Date().toISOString(),
    targetFolder: "lumisec-docs/helping_docs",
    counts: {
        markdown: md.length,
        postman_collections: postman.filter((f) => f.kind === "collection").length,
        postman_environments: postman.filter((f) => f.kind === "environment").length,
        postman_total: postman.length,
        totalMoved: moved.length
    },
    sourceDirectories: [...sourceDirs].sort(),
    duplicateFlags,
    files: moved
};

fs.writeFileSync(path.join(TARGET, "index.json"), JSON.stringify(summary, null, 2));

const report = `# Documentation Centralization Report

Generated: ${summary.generatedAt}

## Totals

| Type | Count |
|------|-------|
| Markdown (.md) | ${summary.counts.markdown} |
| Postman collections | ${summary.counts.postman_collections} |
| Postman environments | ${summary.counts.postman_environments} |
| **Total moved** | ${summary.counts.totalMoved} |

## Source Directories Emptied / Touched

${summary.sourceDirectories.map((d) => `- \`${d}/\``).join("\n")}

## Moved Files

### Markdown
${moved.filter((f) => f.type === "markdown").map((f) => `- \`${f.originalPath}\` → \`${f.newPath}\``).join("\n")}

### Postman
${moved.filter((f) => f.type.startsWith("postman")).map((f) => `- \`${f.originalPath}\` → \`${f.newPath}\``).join("\n")}

## Duplicate Flags (same name + same size)

${duplicateFlags.length ? duplicateFlags.map((f) => `- \`${f.filename}\` from \`${f.originalPath}\` — ${f.reason}`).join("\n") : "_None_"}

## Broken Reference Warnings (not auto-fixed)

The following code/docs may reference old paths:

- \`docs/PROJECT_EXPLANATION.md\` referenced \`postman/LumiSec-API.postman_collection.json\`
- \`postman/LumiSec-GRC.postman_collection.json\` description referenced \`helpo/LumiSec-GRC-API-Documentation.md\`
- \`SOAR_AUDIT_REPORT.md\` / \`SOAR_COMPLETION_REPORT.md\` cross-reference each other (relative links may need updating if opened from new location)
- \`src/bootstrap.js\` still serves OpenAPI JSON from \`docs/grc-openapi.json\` and \`docs/soar-openapi.json\` (unchanged — not Postman/Markdown)

## Target Layout

\`\`\`
lumisec-docs/helping_docs/
├── markdown/
├── postman/
│   ├── collections/
│   └── environments/
├── index.json
└── CENTRALIZATION_REPORT.md
\`\`\`
`;

fs.writeFileSync(path.join(TARGET, "CENTRALIZATION_REPORT.md"), report);

console.log(JSON.stringify(summary.counts, null, 2));
console.log("Moved", summary.counts.totalMoved, "files to lumisec-docs/helping_docs/");
