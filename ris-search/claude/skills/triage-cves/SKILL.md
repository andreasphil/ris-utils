---
name: triage-cves
description: |
  Analyze Trivy SARIF reports and fix vulnerabilities. Fast path: given a CVE ID + package + version directly, pins it immediately without a report. OS/image-level packages are reported but not patched.
---

## What I do

Given one or more Trivy SARIF files, I:

1. Parse all findings and classify each one
2. Produce a triage report grouped by severity and type
3. Fix HIGH/CRITICAL application vulnerabilities in the codebase
4. Proactively offer to also fix MEDIUM/LOW application vulnerabilities

CI only fails on HIGH/CRITICAL — both scan jobs gate on `grep -qE 'HIGH|CRITICAL'` over the SARIF. That is why MEDIUM/LOW are offered rather than fixed by default.

Parsing/classification and templated file edits are scripted (`scripts/`) — the only judgment calls left are: which SARIF file(s) to analyze, which target version to pin, and whether to also fix MEDIUM/LOW.

## Fast path: direct pin

If the user provides a CVE ID, package coordinate, and target version directly — e.g. _"fix CVE-2025-1234 by pinning `com.example:foo` to `2.3.4`"_ — skip straight to `scripts/apply-fix.js` (see Step 4). No report needed. Still output the Step 6 summary when done.

## Step 1: Gather inputs

If the user has not provided SARIF file paths, ask:

> "Which SARIF file(s) should I analyze? Please provide the file path(s)."

Accept any number of files. Each is analyzed independently; findings from all files are combined into a single report.

## Step 2 & 3: Parse, classify, and render the report

Run:

```bash
node .claude/skills/triage-cves/scripts/parse-sarif.js <file1.sarif> [file2.sarif ...]
```

This prints the triage report directly (grouped HIGH/CRITICAL app, MEDIUM/LOW app, OS/unreachable tables) — post it as-is, or condense to a couple of lines if there are only one or two findings. Add `--json` to get the classified findings as structured data instead (useful for scripting Step 4 across many findings).

The script implements this classification, for reference/debugging:

- `runs[].tool.driver.rules[].name`: `OsPackageVulnerability` → image-level (can't fix in code); `LanguageSpecificPackageVulnerability` → application-level (can fix)
- Ecosystem from `locations[].physicalLocation.artifactLocation.uri`: `BOOT-INF/lib/`/`.jar` → Java/Gradle; `node_modules/`/`package.json` → Node; a path under `npm/node_modules/` or `pnpm/node_modules/` → bundled inside the package manager itself, not reachable via app code
- Severity from `properties.tags` or `properties.security-severity`
- Ignore-file mapping (which scan → which `.trivyignore`):

| Scan | Defined in | Ignore file applied |
| ---- | ---------- | ------------------- |
| frontend source (`fs`, skips `node_modules`) | `frontend.yml` → `frontend-file-scan` | `frontend/.trivyignore` |
| frontend image | `scan-attest-sign-image.yml`, `app: frontend` | `frontend/.trivyignore` |
| backend image | `scan-attest-sign-image.yml`, `app: backend` | `backend/.trivyignore` |
| api-docs image | `scan-attest-sign-image.yml`, `app: api-docs` | `api-docs/.trivyignore` |

There is no source (`fs`) scan for backend or api-docs — those are image-scanned only.

## Step 4: Fix HIGH/CRITICAL application vulnerabilities

Apply fixes immediately after the report. If there are no HIGH/CRITICAL application findings, state that clearly and skip to Step 5.

**Choosing the target version** is not scripted — use the lowest fixed version that does NOT require a major upgrade (prefer patch/minor bumps within the same major line).

### Backend (Java/Gradle) fixes

**Direct dependency:** bump the version in `backend/gradle/libs.versions.toml` directly instead of using the script below.

**Transitive dependency — override it:**

```bash
node .claude/skills/triage-cves/scripts/apply-fix.js backend \
  --cve <CVE-ID> --alias <alias> --module <group:artifact> --version <version> [--bom]
```

This inserts the pin into `backend/gradle/libs.versions.toml` (grouped at the end of `[libraries]`, with a `# <CVE-ID>` comment) and the matching `implementation(...)` line into `backend/build.gradle.kts` (grouped with other CVE overrides). Use `--bom` if one CVE spans several artifacts from the same project — pin the project's BOM instead of each artifact; the script wraps it as `implementation(platform(libs.<alias>))`.

**Alias naming:** no strict rule — match the existing entries, which keep the artifactId and add just enough group context to stay unambiguous:

| Maven coordinate                                | TOML alias           | Gradle accessor           |
| ----------------------------------------------- | -------------------- | ------------------------- |
| `com.fasterxml.jackson.core:jackson-databind`   | `jackson-databind`   | `libs.jackson.databind`   |
| `io.netty:netty-codec-http2`                    | `netty-codec-http2`  | `libs.netty.codec.http2`  |
| `org.apache.httpcomponents.core5:httpcore5`     | `apache-httpcore`    | `libs.apache.httpcore`    |
| `org.apache.httpcomponents.core5:httpcore5-h2`  | `apache-httpcore-h2` | `libs.apache.httpcore.h2` |
| `org.bouncycastle:bc-jdk18on-bom`               | `bouncycastle-bom`   | `libs.bouncycastle.bom`   |

Dashes in the alias become dots in the Gradle accessor.

**Lockfile:** the backend runs `dependencyLocking { lockAllConfigurations() }`, so `gradle.lockfile` MUST be regenerated after any dependency change or the build fails:

```bash
cd backend
./gradlew :dependencies --write-locks
```

### Frontend / API docs (Node.js) fixes

**Direct dependency:** update the version in `frontend/package.json` or `api-docs/package.json` directly, depending on which scan flagged it. Both projects set `minimumReleaseAge`, so a very fresh release also needs an entry in that project's `minimumReleaseAgeExclude` list in `pnpm-workspace.yaml`.

**Transitive dependency:**

1. First try `pnpm up` (from `frontend/` or `api-docs/`) — bumps all deps to their latest allowed version and often resolves transitive issues.
2. If the issue persists, add an override:

```bash
node .claude/skills/triage-cves/scripts/apply-fix.js pnpm \
  --project <frontend|api-docs> --cve <CVE-ID> --package <name> --version <range>
```

This adds/creates the `overrides:` block in that project's `pnpm-workspace.yaml` (api-docs has none by default).

3. Then run `pnpm install`.

**If the vulnerable package is bundled inside npm/pnpm itself** (path contains `npm/node_modules/` or `pnpm/node_modules/`): the app cannot fix this. Treat it like an OS-level finding — report it, note that it needs a newer npm/pnpm in the base image, and add the CVE to the matching `.trivyignore` with a comment naming the bundling tool and why it's unreachable in production. Each ignore file already carries a header explaining that intent; keep new entries grouped under a matching comment.

Note that `frontend/.trivyignore` is passed to **both** the frontend source scan and the frontend image scan, so an entry there silences the CVE in both. Don't use it to paper over a finding the app could actually fix.

## Step 5: Offer to fix MEDIUM/LOW application vulnerabilities

After completing (or skipping) Step 4, if there are MEDIUM or LOW application-level findings, ask:

> "I found [N] MEDIUM/LOW application vulnerabilities. Want me to fix those too?"

If the user says yes, apply the same ecosystem-specific fix logic from Step 4 to those findings. Do not attempt to fix them automatically without asking first.

## Step 6: Report what was done

At the end, output a concise summary:

```
## Changes made
### Fixed
- CVE-XXXX-YYYY: some-library 1.2.3 → 1.2.4 (backend, libs.versions.toml)
- CVE-XXXX-ZZZZ: another-lib 5.0.0 → 5.0.1 (frontend, pnpm-workspace.yaml override)

### Skipped / cannot fix
- CVE-XXXX-AAAA: giflib (OS package — requires base image update)
- CVE-XXXX-BBBB: picomatch (bundled in npm — requires npm version bump in base image)
```

## How to verify fixes

### Backend

```bash
cd backend
./gradlew dependencies --configuration productionRuntimeClasspath | grep -i <artifact-name>
```

`productionRuntimeClasspath` is what `bootJar` packs into `BOOT-INF/lib`, i.e. what the image scan actually sees. Confirm the resolved version is at or above the fixed version, and that no `FAILED` marker sits next to it — that means the lockfile is stale, so rerun `./gradlew :dependencies --write-locks`.

### Frontend / API docs

Mirror what CI does so the result matches the gate:

```bash
# source scan (frontend only — CI has no api-docs fs scan)
trivy fs ./frontend --skip-dirs node_modules --ignorefile frontend/.trivyignore --format table

# image scan
docker build -t ris-frontend-check ./frontend        # or ./api-docs, ./backend
trivy image ris-frontend-check --ignorefile frontend/.trivyignore --format table
```

## scripts/

- `parse-sarif.js <file...> [--json]` — Steps 2/3: parses and classifies findings, renders the triage report (or emits JSON with `--json`).
- `apply-fix.js backend --cve <id> --alias <alias> --module <group:artifact> --version <version> [--bom]` — Step 4: inserts a backend Gradle pin.
- `apply-fix.js pnpm --project <frontend|api-docs> --cve <id> --package <name> --version <range>` — Step 4: inserts/creates a pnpm override.

Both `apply-fix.js` modes only do the mechanical file edit — run the accompanying `./gradlew :dependencies --write-locks` / `pnpm install` yourself afterward.
