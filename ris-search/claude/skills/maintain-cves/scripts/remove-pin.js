import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";

// Structural removal of one CVE mitigation, for maintain-cves Step 2.
// Mirrors triage-cves/scripts/apply-fix.js in reverse. Prints the removed
// entry's details as JSON on stdout so a caller (verify-pin.sh) can decide
// whether to restore it.
//
// Usage:
//   remove-pin.js backend --alias <alias>
//   remove-pin.js pnpm --project <frontend|api-docs> --package <name>

/**
 * @param {string[]} args
 */
function parseFlags(args) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    flags[a.slice(2)] = args[i + 1];
    i++;
  }
  return flags;
}

/**
 * @param {string} alias
 */
function removeBackendPin(alias) {
  const tomlPath = "backend/gradle/libs.versions.toml";
  const gradlePath = "backend/build.gradle.kts";

  const tomlLines = readFileSync(tomlPath, "utf-8").split("\n");
  const pinIdx = tomlLines.findIndex((l) => l.startsWith(`${alias} = `));
  if (pinIdx === -1) {
    console.error(`Alias '${alias}' not found in ${tomlPath}`);
    exit(1);
  }

  const pinLine = tomlLines[pinIdx];
  const module_ = pinLine.match(/module\s*=\s*"([^"]+)"/)?.[1];
  const version = pinLine.match(/version\s*=\s*"([^"]+)"/)?.[1];
  const cveLineIdx = pinIdx - 1;
  const cve = tomlLines[cveLineIdx]?.match(/^# ((?:CVE|GHSA)-\S+)/)?.[1];

  if (!module_ || !version || !cve) {
    console.error(`Could not fully parse pin for '${alias}' (module=${module_}, version=${version}, cve=${cve})`);
    exit(1);
  }

  const removeFrom = cveLineIdx;
  let removeTo = pinIdx;
  if (tomlLines[removeTo + 1]?.trim() === "") removeTo++;
  tomlLines.splice(removeFrom, removeTo - removeFrom + 1);
  writeFileSync(tomlPath, tomlLines.join("\n"));

  const accessor = `libs.${alias.replace(/-/g, ".")}`;
  const gradleLines = readFileSync(gradlePath, "utf-8").split("\n");
  const implIdx = gradleLines.findIndex((l) => l.includes(accessor));
  if (implIdx === -1) {
    console.error(`No implementation(...) line referencing ${accessor} found in ${gradlePath}`);
    exit(1);
  }
  const isBom = /platform\(/.test(gradleLines[implIdx]);

  let gRemoveFrom = implIdx;
  if (/^\s*\/\/ (CVE-|GHSA-)/.test(gradleLines[implIdx - 1] ?? "")) gRemoveFrom = implIdx - 1;
  let gRemoveTo = implIdx;
  gradleLines.splice(gRemoveFrom, gRemoveTo - gRemoveFrom + 1);
  writeFileSync(gradlePath, gradleLines.join("\n"));

  console.log(JSON.stringify({ cve, alias, module: module_, version, isBom }));
}

/**
 * @param {string} project
 * @param {string} pkg
 */
function removePnpmOverride(project, pkg) {
  const yamlPath = `${project}/pnpm-workspace.yaml`;
  const lines = readFileSync(yamlPath, "utf-8").split("\n");
  const idx = lines.findIndex((l) => new RegExp(`^\\s+${pkg}:`).test(l));
  if (idx === -1) {
    console.error(`Package '${pkg}' not found under overrides: in ${yamlPath}`);
    exit(1);
  }

  const line = lines[idx];
  const version = line.match(/:\s*"([^"]+)"/)?.[1];
  const cve = line.match(/#\s*((?:CVE|GHSA)-\S+)/)?.[1] ?? null;

  lines.splice(idx, 1);
  writeFileSync(yamlPath, lines.join("\n"));

  console.log(JSON.stringify({ cve, package: pkg, version }));
}

function main() {
  const [mode, ...rest] = argv.slice(2);
  const flags = parseFlags(rest);

  if (mode === "backend") {
    if (!flags.alias) {
      console.error("Usage: remove-pin.js backend --alias <alias>");
      exit(1);
    }
    removeBackendPin(flags.alias);
  } else if (mode === "pnpm") {
    if (!flags.project || !flags.package) {
      console.error("Usage: remove-pin.js pnpm --project <frontend|api-docs> --package <name>");
      exit(1);
    }
    removePnpmOverride(flags.project, flags.package);
  } else {
    console.error("Usage: remove-pin.js <backend|pnpm> ...");
    exit(1);
  }
}

main();
