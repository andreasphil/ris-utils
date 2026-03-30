#!/usr/bin/env node
/**
 * Analyzes inline styles across downloaded HTML samples and writes a report.
 *
 * For each document type (case-law, literature, administrative-directive,
 * legislation) it reports:
 *   - Every CSS property that appears in an inline style
 *   - The elements those properties appear on
 *   - Counts and document-type breakdown
 *
 * Usage:
 *   node html-samples/analyze.mjs
 *
 * Output:
 *   html-samples/report.html
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DOCUMENT_TYPES = [
  "case-law",
  "literature",
  "administrative-directive",
  "legislation",
];

const OUTPUT_FILE = join(__dirname, "report.html");

// ── Parsing ───────────────────────────────────────────────────────────────────

// Matches opening tags that carry a non-empty style attribute.
// Captures: (1) element name, (2) style value
const TAG_WITH_STYLE_RE =
  /<([a-zA-Z][a-zA-Z0-9]*)(?:[^>]*?)\bstyle="([^"]+)"[^>]*>/g;

// Individual CSS declarations inside a style value: "property: value;"
const DECLARATION_RE = /([a-zA-Z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;

/**
 * @typedef {{ element: string, property: string, value: string, rawStyle: string }} Occurrence
 */

/**
 * Extract every (element, property, value) occurrence from an HTML string.
 * A single style attribute may contain multiple declarations; each is emitted
 * as a separate Occurrence. The raw style value is preserved on every occurrence
 * so multi-property styles can be detected and reported.
 * @param {string} html
 * @returns {Occurrence[]}
 */
function extractOccurrences(html) {
  const occurrences = [];
  for (const [, element, styleValue] of html.matchAll(TAG_WITH_STYLE_RE)) {
    if (!styleValue.trim()) continue;
    const declarations = [...styleValue.matchAll(DECLARATION_RE)];
    for (const [, property, value] of declarations) {
      occurrences.push({
        element: element.toLowerCase(),
        property: property.toLowerCase(),
        value: value.trim(),
        rawStyle: styleValue.trim(),
      });
    }
  }
  return occurrences;
}

// ── Data collection ───────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   occurrences: Occurrence[],
 *   totalFiles: number,
 *   filesWithStyles: number,
 *   multiPropertyStyles: Array<{ element: string, rawStyle: string }>,
 * }} TypeStats
 */

async function collectForType(docType) {
  const dir = join(__dirname, docType);
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".html"));
  } catch {
    return { occurrences: [], totalFiles: 0, filesWithStyles: 0, multiPropertyStyles: [] };
  }

  let filesWithStyles = 0;
  const occurrences = [];
  // Deduplicated set of multi-property raw style values (element → Set<rawStyle>)
  const multiPropertyStyles = [];
  const seen = new Set();

  for (const file of files) {
    const html = await readFile(join(dir, file), "utf8");
    const found = extractOccurrences(html);
    if (found.length > 0) filesWithStyles++;
    occurrences.push(...found);

    // Detect multi-property style attributes in this file
    for (const [, element, styleValue] of html.matchAll(TAG_WITH_STYLE_RE)) {
      if (!styleValue.trim()) continue;
      const declarations = [...styleValue.matchAll(DECLARATION_RE)];
      if (declarations.length > 1) {
        const key = `${element.toLowerCase()}|${styleValue.trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          multiPropertyStyles.push({
            element: element.toLowerCase(),
            rawStyle: styleValue.trim(),
          });
        }
      }
    }
  }

  return { occurrences, totalFiles: files.length, filesWithStyles, multiPropertyStyles };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Group occurrences into a nested map:
 *   property → element → { values: Map<string, number>, total: number }
 *
 * @param {Occurrence[]} occurrences
 */
function aggregate(occurrences) {
  // property → element → { values: Map<value, count>, total }
  const byProperty = new Map();

  for (const { element, property, value } of occurrences) {
    if (!byProperty.has(property)) byProperty.set(property, new Map());
    const byElement = byProperty.get(property);

    if (!byElement.has(element)) {
      byElement.set(element, { values: new Map(), total: 0 });
    }
    const entry = byElement.get(element);
    entry.total++;
    entry.values.set(value, (entry.values.get(value) ?? 0) + 1);
  }

  return byProperty;
}

// ── Report rendering ──────────────────────────────────────────────────────────

function fmt(n) {
  return n.toLocaleString("en");
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function code(str) {
  return `<code>${esc(str)}</code>`;
}

function renderTable(head, rows) {
  const ths = head.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("\n");
  return `<table>\n<thead><tr>${ths}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table>`;
}

function renderReport(allStats) {
  const totalFiles = DOCUMENT_TYPES.reduce(
    (s, t) => s + allStats[t].totalFiles,
    0,
  );

  const allOccurrences = DOCUMENT_TYPES.flatMap((t) => allStats[t].occurrences);
  const globalByProperty = aggregate(allOccurrences);
  const sortedProperties = [...globalByProperty.entries()].sort(
    (a, b) =>
      [...b[1].values()].reduce((s, e) => s + e.total, 0) -
      [...a[1].values()].reduce((s, e) => s + e.total, 0),
  );

  const allMulti = DOCUMENT_TYPES.flatMap((t) =>
    allStats[t].multiPropertyStyles.map((m) => ({ ...m, docType: t })),
  );

  // ── Nav links ─────────────────────────────────────────────────────────────
  const navLinks = [
    '<a href="#multi">Multi-property styles</a>',
    '<a href="#summary">Summary</a>',
    '<a href="#global">All types combined</a>',
    ...DOCUMENT_TYPES.map(
      (t) => `<a href="#type-${t}">${esc(t)}</a>`,
    ),
  ].join("\n");

  // ── Multi-property section ────────────────────────────────────────────────
  let multiSection;
  if (allMulti.length > 0) {
    const table = renderTable(
      ["Document type", "Element", "Style value"],
      allMulti.map(({ docType, element, rawStyle }) => [
        esc(docType),
        code(element),
        code(rawStyle),
      ]),
    );
    multiSection = `
<section id="multi" class="warning">
  <h2>⚠ Multi-property inline styles detected</h2>
  <p>Found <strong>${fmt(allMulti.length)}</strong> distinct multi-property style attribute(s) across all document types.
  Each row is a unique combination of element and style value.</p>
  ${table}
</section>`;
  } else {
    multiSection = `
<section id="multi">
  <h2>Multi-property inline styles</h2>
  <p class="muted">No multi-property inline styles found in this sample. All style attributes contain exactly one CSS declaration.</p>
</section>`;
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  const summaryTable = renderTable(
    ["Document type", "Files", "Files with styles", "Total occurrences", "Multi-property styles"],
    DOCUMENT_TYPES.map((t) => {
      const { totalFiles: tf, filesWithStyles, occurrences, multiPropertyStyles } = allStats[t];
      return [
        `<a href="#type-${t}">${esc(t)}</a>`,
        fmt(tf),
        fmt(filesWithStyles),
        fmt(occurrences.length),
        multiPropertyStyles.length > 0
          ? `<span class="badge-warn">${fmt(multiPropertyStyles.length)}</span>`
          : fmt(0),
      ];
    }),
  );

  // ── Global property sections ──────────────────────────────────────────────
  const globalSections = sortedProperties.map(([property, byElement]) => {
    const totalForProperty = [...byElement.values()].reduce(
      (s, e) => s + e.total,
      0,
    );

    const perType = DOCUMENT_TYPES.flatMap((docType) => {
      const n = allStats[docType].occurrences.filter(
        (o) => o.property === property,
      ).length;
      return n > 0 ? [`${esc(docType)}: ${fmt(n)}`] : [];
    }).join(" &nbsp;·&nbsp; ");

    const sortedElements = [...byElement.entries()].sort(
      (a, b) => b[1].total - a[1].total,
    );

    const table = renderTable(
      ["Element", "Occurrences", "Distinct values", "Top values"],
      sortedElements.map(([element, { values, total }]) => {
        const topValues = [...values.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([v]) => code(v))
          .join(", ");
        return [code(element), fmt(total), fmt(values.size), topValues];
      }),
    );

    return `
<article>
  <h3>${code(property)}</h3>
  <p><strong>Total occurrences:</strong> ${fmt(totalForProperty)} &nbsp;·&nbsp; <strong>By type:</strong> ${perType}</p>
  ${table}
</article>`;
  }).join("\n");

  // ── Per-type detail sections ──────────────────────────────────────────────
  const typeSections = DOCUMENT_TYPES.map((docType) => {
    const { occurrences, totalFiles: tf, filesWithStyles } = allStats[docType];

    if (occurrences.length === 0) {
      return `
<section id="type-${docType}">
  <h2>${esc(docType)}</h2>
  <p class="muted">${fmt(filesWithStyles)}/${fmt(tf)} files contain inline styles. No inline styles found in this sample.</p>
</section>`;
    }

    const byProperty = aggregate(occurrences);
    const sorted = [...byProperty.entries()].sort(
      (a, b) =>
        [...b[1].values()].reduce((s, e) => s + e.total, 0) -
        [...a[1].values()].reduce((s, e) => s + e.total, 0),
    );

    const summaryTable = renderTable(
      ["Property", "Element(s)", "Occurrences", "Distinct values"],
      sorted.map(([property, byElement]) => {
        const total = [...byElement.values()].reduce((s, e) => s + e.total, 0);
        const elements = [...byElement.keys()].map(code).join(", ");
        const distinctValues = new Set(
          [...byElement.values()].flatMap((e) => [...e.values.keys()]),
        ).size;
        return [code(property), elements, fmt(total), fmt(distinctValues)];
      }),
    );

    const valueDetails = sorted.map(([property, byElement]) => {
      const rows = [...byElement.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([element, { values }]) => {
          const valueList = [...values.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([v, count]) => `<li>${code(v)} <span class="count">${fmt(count)}×</span></li>`)
            .join("");
          return `<dt>on ${code(element)}</dt><dd><ul>${valueList}</ul></dd>`;
        })
        .join("");
      return `<div class="value-group"><h4>${code(property)}</h4><dl>${rows}</dl></div>`;
    }).join("\n");

    return `
<section id="type-${docType}">
  <h2>${esc(docType)}</h2>
  <p>${fmt(filesWithStyles)}/${fmt(tf)} files contain inline styles &nbsp;·&nbsp; ${fmt(occurrences.length)} total occurrences</p>
  ${summaryTable}
  <details>
    <summary>Value breakdown per property</summary>
    <div class="value-details">${valueDetails}</div>
  </details>
</section>`;
  }).join("\n");

  // ── Full document ─────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inline Style Analysis Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #f8f8f8;
      margin: 0;
      padding: 0;
    }

    nav {
      position: sticky;
      top: 0;
      background: #1a1a1a;
      color: #fff;
      padding: 0.5rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      align-items: center;
      z-index: 10;
      font-size: 13px;
    }
    nav a { color: #ccc; text-decoration: none; }
    nav a:hover { color: #fff; text-decoration: underline; }

    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 0.75rem; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.25rem; }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.5rem; }
    h4 { font-size: 0.9rem; margin: 1rem 0 0.25rem; color: #444; }

    p { margin: 0.25rem 0 0.75rem; }
    .muted { color: #666; font-style: italic; }

    section { margin-bottom: 2rem; }
    article { margin-bottom: 1.5rem; }

    section.warning { background: #fffbea; border-left: 4px solid #f59e0b; padding: 1rem 1.25rem; border-radius: 0 4px 4px 0; }
    section.warning h2 { border-color: #fcd34d; }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5rem 0 1rem;
      background: #fff;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    th {
      background: #f0f0f0;
      text-align: left;
      padding: 0.45rem 0.75rem;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
      white-space: nowrap;
    }
    td {
      padding: 0.4rem 0.75rem;
      border-top: 1px solid #ebebeb;
      vertical-align: top;
    }
    tr:hover td { background: #fafafa; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { white-space: nowrap; }

    code {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      background: #f0f0f0;
      padding: 0.1em 0.3em;
      border-radius: 3px;
      color: #c7254e;
    }
    section.warning code { background: #fef3c7; }

    .count { color: #888; font-size: 12px; }
    .badge-warn {
      display: inline-block;
      background: #f59e0b;
      color: #fff;
      border-radius: 10px;
      padding: 0.1em 0.5em;
      font-size: 12px;
      font-weight: 600;
    }

    details { margin: 0.75rem 0; }
    summary {
      cursor: pointer;
      font-weight: 600;
      color: #2563eb;
      font-size: 13px;
      padding: 0.35rem 0;
      user-select: none;
    }
    summary:hover { text-decoration: underline; }

    .value-details { padding: 0.75rem 0 0; display: flex; flex-wrap: wrap; gap: 1rem; }
    .value-group { min-width: 200px; flex: 1; }
    dl { margin: 0; }
    dt { font-weight: 600; font-size: 12px; color: #555; margin-top: 0.4rem; }
    dd { margin: 0 0 0 0.5rem; }
    dd ul { margin: 0.2rem 0; padding-left: 1.1rem; }
    dd li { font-size: 12px; color: #333; }
  </style>
</head>
<body>
<nav>
  <strong style="color:#fff;margin-right:0.5rem">Inline Styles</strong>
  ${navLinks}
</nav>
<main>
  <h1>Inline Style Analysis Report</h1>
  <p class="muted">Analyzed ${DOCUMENT_TYPES.length} document types, ${fmt(totalFiles)} files total.</p>

  ${multiSection}

  <section id="summary">
    <h2>Summary by document type</h2>
    ${summaryTable}
  </section>

  <section id="global">
    <h2>Styles used (all document types combined)</h2>
    <p>Found <strong>${fmt(sortedProperties.length)} distinct CSS properties</strong> across all documents.</p>
    ${globalSections}
  </section>

  <section id="per-type">
    <h2>Per document type detail</h2>
    ${typeSections}
  </section>
</main>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Collecting data...");
  const allStats = {};
  for (const docType of DOCUMENT_TYPES) {
    process.stdout.write(`  ${docType}...`);
    allStats[docType] = await collectForType(docType);
    const { occurrences, filesWithStyles, multiPropertyStyles } = allStats[docType];
    const multiNote = multiPropertyStyles.length > 0 ? `, ${multiPropertyStyles.length} multi-property` : "";
    console.log(
      ` ${occurrences.length} occurrences in ${filesWithStyles} files${multiNote}`,
    );
  }

  console.log("Generating report...");
  const report = renderReport(allStats);
  await writeFile(OUTPUT_FILE, report, "utf8");
  console.log(`Report written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
