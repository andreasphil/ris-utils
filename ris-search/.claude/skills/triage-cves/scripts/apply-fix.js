import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";
import { styleText } from "node:util";

// Templated edits for triage-cves Step 4. Only handles the mechanical
// insertion; picking the target version is still a human/LLM call.

/**
 * @param {string[]} args
 */
function parseFlags(args) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

/**
 * @param {string} cve
 * @param {string} alias
 * @param {string} module_
 * @param {string} version
 */
function applyBackendPin(cve, alias, module_, version, isBom) {
  const tomlPath = "backend/gradle/libs.versions.toml";
  const gradlePath = "backend/build.gradle.kts";

  const tomlLines = readFileSync(tomlPath, "utf-8").split("\n");
  const pluginsIdx = tomlLines.findIndex((l) => l.trim() === "[plugins]");
  if (pluginsIdx === -1) {
    console.error(styleText("red", `Could not find [plugins] section in ${tomlPath}`));
    exit(1);
  }
  const tomlEntry = [`# ${cve}`, `${alias} = { module = "${module_}", version = "${version}" }`, ""];
  tomlLines.splice(pluginsIdx, 0, ...tomlEntry);
  writeFileSync(tomlPath, tomlLines.join("\n"));

  const accessor = `libs.${alias.replace(/-/g, ".")}`;
  const implLine = isBom
    ? `    implementation(platform(${accessor}))`
    : `    implementation(${accessor})`;

  const gradleLines = readFileSync(gradlePath, "utf-8").split("\n");
  const depsStart = gradleLines.findIndex((l) => l.trim() === "dependencies {");
  if (depsStart === -1) {
    console.error(styleText("red", `Could not find "dependencies {" block in ${gradlePath}`));
    exit(1);
  }
  let depth = 0;
  let depsEnd = -1;
  for (let i = depsStart; i < gradleLines.length; i++) {
    depth += (gradleLines[i].match(/{/g) ?? []).length;
    depth -= (gradleLines[i].match(/}/g) ?? []).length;
    if (depth === 0) {
      depsEnd = i;
      break;
    }
  }

  let lastCveGroupEnd = -1;
  for (let i = depsStart; i < depsEnd; i++) {
    if (/^\s*\/\/ (CVE-|GHSA-)/.test(gradleLines[i])) {
      // the group is this comment line + the following non-blank line(s)
      // until the next blank line or comment
      let j = i + 1;
      while (j < depsEnd && gradleLines[j].trim() !== "" && !/^\s*\/\//.test(gradleLines[j])) j++;
      lastCveGroupEnd = j;
    }
  }

  const insertAt = lastCveGroupEnd !== -1 ? lastCveGroupEnd : depsEnd;
  const entry = lastCveGroupEnd !== -1
    ? [`    // ${cve}`, implLine]
    : ["", `    // ${cve}`, implLine];
  gradleLines.splice(insertAt, 0, ...entry);
  writeFileSync(gradlePath, gradleLines.join("\n"));

  console.log(styleText("green", `Inserted ${cve} pin into ${tomlPath} and ${gradlePath}.`));
  console.log("Next: cd backend && ./gradlew :dependencies --write-locks");
}

/**
 * @param {string} project
 * @param {string} cve
 * @param {string} pkg
 * @param {string} versionRange
 */
function applyPnpmOverride(project, cve, pkg, versionRange) {
  const path = `${project}/pnpm-workspace.yaml`;
  const lines = readFileSync(path, "utf-8").split("\n");
  const overridesIdx = lines.findIndex((l) => l.trim() === "overrides:");
  const entry = `  ${pkg}: "${versionRange}" # ${cve}`;

  if (overridesIdx === -1) {
    lines.push("overrides:", entry);
  } else {
    let end = overridesIdx + 1;
    while (end < lines.length && /^\s\s/.test(lines[end])) end++;
    lines.splice(end, 0, entry);
  }

  writeFileSync(path, lines.join("\n"));
  console.log(styleText("green", `Added override for ${pkg} (${cve}) to ${path}.`));
  console.log(`Next: cd ${project} && pnpm install`);
}

function main() {
  const [mode, ...rest] = argv.slice(2);
  const flags = parseFlags(rest);

  if (mode === "backend") {
    const { cve, alias, module: module_, version, bom } = flags;
    if (!cve || !alias || !module_ || !version) {
      console.error(styleText("red", "Usage: apply-fix.js backend --cve <id> --alias <alias> --module <group:artifact> --version <version> [--bom]"));
      exit(1);
    }
    applyBackendPin(/** @type {string} */(cve), /** @type {string} */(alias), /** @type {string} */(module_), /** @type {string} */(version), Boolean(bom));
  } else if (mode === "pnpm") {
    const { project, cve, package: pkg, version } = flags;
    if (!project || !cve || !pkg || !version) {
      console.error(styleText("red", "Usage: apply-fix.js pnpm --project <frontend|api-docs> --cve <id> --package <name> --version <range>"));
      exit(1);
    }
    applyPnpmOverride(/** @type {string} */(project), /** @type {string} */(cve), /** @type {string} */(pkg), /** @type {string} */(version));
  } else {
    console.error(styleText("red", "Usage: apply-fix.js <backend|pnpm> ..."));
    exit(1);
  }
}

main();
