#!/usr/bin/env node
/**
 * Downloads 100 HTML documents per document type from the RIS staging API.
 *
 * Document types:
 *   - case-law         → /v1/case-law/{documentNumber}.html
 *   - literature       → /v1/literature/{documentNumber}.html
 *   - administrative-directive → /v1/administrative-directive/{documentNumber}.html
 *   - legislation      → /v1/legislation/eli/.../{subtype}.html
 *                        (requires a 2-step fetch: list → expression metadata → HTML URL)
 *
 * Authentication: reads a Basic Auth password from 1Password via `op read`.
 * Requires the 1Password CLI (`op`) to be installed and signed in.
 *
 * Usage:
 *   node html-samples/download.mjs [--size <n>]
 *
 * Options:
 *   --size <n>   Number of documents to download per type (default: 100, max: 300)
 *               Search results are fetched in pages of 100 to stay within API limits.
 *
 * Output:
 *   html-samples/case-law/
 *   html-samples/literature/
 *   html-samples/administrative-directive/
 *   html-samples/legislation/
 */

import { execSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://ris-portal.dev.ds4g.net";
const CONCURRENCY = 10;

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const sizeArg = args[args.indexOf("--size") + 1];
const SAMPLE_SIZE = sizeArg ? parseInt(sizeArg, 10) : 100;

const PAGE_SIZE = 100;
const BATCH_DELAY_MS = 200;

// ── Auth ──────────────────────────────────────────────────────────────────────

function getBasicAuthHeader() {
  const password = execSync(
    "op read 'op://Team NeuRIS/Basic auth public portal staging/password'",
    { encoding: "utf8" },
  ).trim();
  return (
    "Basic " + Buffer.from(`basic-auth-staging:${password}`).toString("base64")
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiGet(path, authHeader) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchHtml(path, authHeader) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.text();
}

// ── Concurrency helper ────────────────────────────────────────────────────────

async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    const done = Math.min(i + batchSize, items.length);
    process.stdout.write(`  ${done}/${items.length}\r`);
    if (done < items.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  console.log();
  return results;
}

/**
 * Fetch up to `total` items from a paginated list endpoint, requesting at most
 * PAGE_SIZE (100) results per page to stay within API limits.
 * Returns the flattened array of `item` objects.
 * @param {string} endpoint  e.g. "/v1/case-law"
 * @param {number} total
 * @param {string} authHeader
 * @returns {Promise<object[]>}
 */
async function fetchSearchResults(endpoint, total, authHeader) {
  const items = [];
  let pageIndex = 0;
  while (items.length < total) {
    const remaining = total - items.length;
    const pageSize = Math.min(remaining, PAGE_SIZE);
    const data = await apiGet(
      `${endpoint}?size=${pageSize}&pageIndex=${pageIndex}`,
      authHeader,
    );
    const members = data?.member ?? [];
    const page = members.map((m) => m.item ?? m).filter(Boolean);
    items.push(...page);
    // Stop if the API returned fewer results than requested (end of data)
    if (page.length < pageSize) break;
    pageIndex++;
  }
  return items;
}

// ── Document-type handlers ────────────────────────────────────────────────────

/**
 * Simple types where the HTML URL is /v1/{type}/{documentNumber}.html
 */
async function downloadSimpleType(type, authHeader) {
  const outDir = join(__dirname, type);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  console.log(`\n[${type}] Fetching list of ${SAMPLE_SIZE} documents...`);
  const items = await fetchSearchResults(`/v1/${type}`, SAMPLE_SIZE, authHeader);
  const documentNumbers = items.map((item) => item.documentNumber).filter(Boolean);

  console.log(`[${type}] Got ${documentNumbers.length} document numbers. Downloading HTML...`);

  const results = await runInBatches(
    documentNumbers,
    CONCURRENCY,
    async (docNum) => {
      const html = await fetchHtml(`/v1/${type}/${docNum}.html`, authHeader);
      await writeFile(join(outDir, `${docNum}.html`), html, "utf8");
    },
  );

  const failed = results.filter((r) => r.status === "rejected");
  console.log(
    `[${type}] Done. ${results.length - failed.length} saved, ${failed.length} failed.`,
  );
  failed.forEach((r) => console.error(`  ✗ ${r.reason?.message ?? r.reason}`));
}

/**
 * Legislation: 2-step fetch.
 * Step 1: list → workExample["@id"] (expression-level path)
 * Step 2: fetch expression metadata → encoding[].contentUrl (text/html)
 * Step 3: fetch + save HTML
 */
async function downloadLegislation(authHeader) {
  const type = "legislation";
  const outDir = join(__dirname, type);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  console.log(`\n[${type}] Fetching list of ${SAMPLE_SIZE} documents...`);
  const items = await fetchSearchResults(`/v1/${type}`, SAMPLE_SIZE, authHeader);

  // Extract expression-level @id paths (e.g. /v1/legislation/eli/bund/.../deu)
  const expressionPaths = items
    .map((item) => item?.workExample?.["@id"] ?? item?.workExample?.[0]?.["@id"])
    .filter(Boolean);

  console.log(
    `[${type}] Got ${expressionPaths.length} expressions. Fetching expression metadata...`,
  );

  // Step 2: fetch each expression's metadata to find the HTML contentUrl
  const metadataResults = await runInBatches(
    expressionPaths,
    CONCURRENCY,
    (path) => apiGet(path, authHeader),
  );

  const htmlUrls = [];
  for (let i = 0; i < metadataResults.length; i++) {
    const result = metadataResults[i];
    if (result.status === "rejected") {
      console.error(
        `  ✗ metadata fetch failed for ${expressionPaths[i]}: ${result.reason?.message ?? result.reason}`,
      );
      continue;
    }
    const metadata = result.value;
    // The expression metadata has workExample.encoding[]
    const encodings = metadata?.workExample?.encoding ?? [];
    const htmlEncoding = encodings.find((e) => e.encodingFormat === "text/html");
    if (!htmlEncoding?.contentUrl) {
      console.warn(`  ⚠ No HTML encoding found for ${expressionPaths[i]}`);
      continue;
    }
    htmlUrls.push(htmlEncoding.contentUrl);
  }

  console.log(
    `[${type}] Got ${htmlUrls.length} HTML URLs. Downloading HTML...`,
  );

  // Step 3: fetch each HTML file
  const results = await runInBatches(htmlUrls, CONCURRENCY, async (htmlPath) => {
    const html = await fetchHtml(htmlPath, authHeader);
    // Sanitize the path into a filename: strip leading /v1/legislation/eli/ and replace / with _
    const filename =
      htmlPath
        .replace(/^\/v1\/legislation\/eli\//, "")
        .replace(/\//g, "_") + "";
    await writeFile(join(outDir, filename), html, "utf8");
  });

  const failed = results.filter((r) => r.status === "rejected");
  console.log(
    `[${type}] Done. ${results.length - failed.length} saved, ${failed.length} failed.`,
  );
  failed.forEach((r) => console.error(`  ✗ ${r.reason?.message ?? r.reason}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Reading credentials from 1Password...");
  const authHeader = getBasicAuthHeader();
  console.log("Credentials loaded.");

  await downloadSimpleType("case-law", authHeader);
  await downloadSimpleType("literature", authHeader);
  await downloadSimpleType("administrative-directive", authHeader);
  await downloadLegislation(authHeader);

  console.log("\nAll done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
