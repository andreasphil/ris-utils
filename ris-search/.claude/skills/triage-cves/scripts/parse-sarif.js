import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";
import { styleText } from "node:util";

// Maps a scanned image/source to the .trivyignore file CI applies to it.
// See ris-search .github/workflows/{frontend,scan-attest-sign-image}.yml.
const IGNORE_FILE_BY_APP = {
  frontend: "frontend/.trivyignore",
  backend: "backend/.trivyignore",
  "api-docs": "api-docs/.trivyignore",
};

/**
 * @param {string} uri
 * @returns {"java" | "node-app" | "node-bundled" | "unknown"}
 */
function ecosystemFromUri(uri) {
  if (!uri) return "unknown";
  if (uri.includes("BOOT-INF/lib/") || uri.endsWith(".jar")) return "java";
  if (/\b(npm|pnpm)\/node_modules\//.test(uri)) return "node-bundled";
  if (uri.includes("node_modules/") || uri.endsWith("package.json")) return "node-app";
  return "unknown";
}

/**
 * @param {string} imageNameOrUri
 * @returns {string}
 */
function appFromContext(imageNameOrUri) {
  for (const app of Object.keys(IGNORE_FILE_BY_APP)) {
    if (imageNameOrUri?.includes(app)) return app;
  }
  // Only frontend has a source (fs) scan, so that's the safe default
  // when nothing in the image name/path names an app.
  return "frontend";
}

/**
 * @param {import("node:fs").PathOrFileDescriptor} rule
 * @returns {"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"}
 */
function severityFromRule(rule) {
  const tags = rule?.properties?.tags ?? [];
  const fromTags = tags.find((t) => /^(CRITICAL|HIGH|MEDIUM|LOW)$/.test(t));
  if (fromTags) return /** @type {any} */ (fromTags);

  const score = rule?.properties?.["security-severity"];
  const numeric = score !== undefined ? Number(score) : NaN;
  if (!Number.isNaN(numeric)) {
    if (numeric >= 9) return "CRITICAL";
    if (numeric >= 7) return "HIGH";
    if (numeric >= 4) return "MEDIUM";
    return "LOW";
  }

  return "UNKNOWN";
}

/**
 * Trivy's SARIF result messages follow a fixed multi-line shape, e.g.:
 *   Package: golang.org/x/net
 *   Installed Version: 0.17.0
 *   Vulnerability CVE-2023-xxxx
 *   Severity: HIGH
 *   Fixed Version: 0.23.0
 *   Link: [CVE-2023-xxxx](...)
 * @param {string} text
 */
function parseMessage(text) {
  const pkg = text.match(/^Package:\s*(.+)$/m)?.[1]?.trim();
  const installed = text.match(/^Installed Version:\s*(.+)$/m)?.[1]?.trim();
  const fixed = text.match(/^Fixed Version:\s*(.+)$/m)?.[1]?.trim();
  return { pkg, installed, fixed };
}

/**
 * @param {string} file
 */
function parseSarifFile(file) {
  /** @type {any} */
  const sarif = JSON.parse(readFileSync(file, "utf-8"));
  const findings = [];

  for (const run of sarif.runs ?? []) {
    const imageName = run.properties?.imageName ?? "";
    const rulesById = new Map(
      (run.tool?.driver?.rules ?? []).map((r) => [r.id, r]),
    );

    for (const result of run.results ?? []) {
      const rule = rulesById.get(result.ruleId);
      const uri =
        result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "";
      const { pkg, installed, fixed } = parseMessage(
        result.message?.text ?? "",
      );
      const ecosystem = ecosystemFromUri(uri);
      const isOs = rule?.name === "OsPackageVulnerability";

      findings.push({
        file,
        imageName,
        id: result.ruleId,
        severity: severityFromRule(rule),
        isOs,
        ecosystem,
        uri,
        pkg: pkg ?? "(unknown)",
        installed: installed ?? "(unknown)",
        fixed: fixed ?? "(unknown)",
        ignoreFile: IGNORE_FILE_BY_APP[appFromContext(imageName || uri)],
        fixable: !isOs && ecosystem !== "node-bundled",
      });
    }
  }

  return findings;
}

/**
 * @param {ReturnType<typeof parseSarifFile>} findings
 */
function renderTable(findings) {
  if (findings.length === 0) return "(none)\n";
  const header = "| CVE | Package | Installed | Fixed in | Ecosystem |\n| --- | --- | --- | --- | --- |\n";
  return (
    header +
    findings
      .map((f) => `| ${f.id} | ${f.pkg} | ${f.installed} | ${f.fixed} | ${f.ecosystem} |`)
      .join("\n") +
    "\n"
  );
}

/**
 * @param {ReturnType<typeof parseSarifFile>} findings
 */
function renderOsTable(findings) {
  if (findings.length === 0) return "(none)\n";
  const header = "| CVE | Severity | Package | Installed | Fixed in |\n| --- | --- | --- | --- | --- |\n";
  return (
    header +
    findings
      .map((f) => `| ${f.id} | ${f.severity} | ${f.pkg} | ${f.installed} | ${f.fixed} |`)
      .join("\n") +
    "\n"
  );
}

function main() {
  const args = argv.slice(2);
  const asJson = args.includes("--json");
  const files = args.filter((a) => a !== "--json");

  if (files.length === 0) {
    console.error(styleText("red", "Usage: parse-sarif.js [--json] <file.sarif> [file2.sarif ...]"));
    exit(1);
  }

  const all = files.flatMap(parseSarifFile);

  if (asJson) {
    console.log(JSON.stringify(all, null, 2));
    return;
  }

  const images = [...new Set(all.map((f) => f.imageName).filter(Boolean))];
  const highCritApp = all.filter((f) => f.fixable && /HIGH|CRITICAL/.test(f.severity));
  const medLowApp = all.filter((f) => f.fixable && /MEDIUM|LOW/.test(f.severity));
  const osOrUnreachable = all.filter((f) => !f.fixable);

  console.log(styleText(["bold"], "## Vulnerability Triage Report"));
  console.log(`Scanned image(s): ${images.join(", ") || "(none named)"}\n`);

  console.log(styleText(["bold"], "### HIGH / CRITICAL — Application (action required)"));
  console.log(renderTable(highCritApp));

  console.log(styleText(["bold"], "### MEDIUM / LOW — Application (fixable)"));
  console.log(renderTable(medLowApp));

  console.log(styleText(["bold"], "### OS / Image packages / bundled tooling (cannot fix in code)"));
  console.log(renderOsTable(osOrUnreachable));
  console.log("These require a base image update, or (for node-bundled findings) a newer npm/pnpm in the base image.\n");

  console.log(styleText(["dim"], "Suggested .trivyignore targets (if any of the above end up ignored):"));
  for (const f of osOrUnreachable) {
    console.log(styleText(["dim"], `  ${f.id} -> ${f.ignoreFile}`));
  }
}

main();
