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

## Fast path: direct pin

If the user provides a CVE ID, package coordinate, and target version directly — e.g. _"fix CVE-2025-1234 by pinning `com.example:foo` to `2.3.4`"_ — skip Steps 1–3 and go straight to **Step 4** to apply the fix. Skip Step 5 (no report to generate). Output the Step 6 summary when done.

## Step 1: Gather inputs

If the user has not provided SARIF file paths, ask:

> "Which SARIF file(s) should I analyze? Please provide the file path(s)."

Accept any number of files. Each is analyzed independently; findings from all files are combined into a single report.

## Step 2: Read and classify every finding

For each rule entry in `runs[].tool.driver.rules[]`, read:

- `id` — the CVE/GHSA identifier
- `name` — **this is the key classifier**:
  - `OsPackageVulnerability` → image-level, cannot be fixed in code
  - `LanguageSpecificPackageVulnerability` → application-level, can be fixed
- `properties.tags` or `properties.security-severity` — severity (CRITICAL/HIGH/MEDIUM/LOW)

For each result in `runs[].results[]`, read the `message.text` for installed version, fixed version, and package name. Read `locations[].physicalLocation.artifactLocation.uri` for the file path — this tells you the ecosystem:

- Path contains `BOOT-INF/lib/` or ends in `.jar` → Java/Gradle dependency
- Path contains `node_modules/` or ends in `package.json` → Node.js/npm dependency
- Path contains `npm/node_modules/` (npm's own bundled deps, not the app's) → bundled inside npm/pnpm itself, cannot be patched via app code

Also check `runs[].properties.imageName` to know which container image was scanned.

## Step 3: Produce the triage report

Output the report inline in the conversation (no file written). Structure:

```
## Vulnerability Triage Report
Scanned image(s): <imageName(s)>

### ❌ HIGH / CRITICAL — Application (action required)
| CVE | Package | Installed | Fixed in | Ecosystem |
...

### ⚠️ MEDIUM / LOW — Application (fixable)
| CVE | Package | Installed | Fixed in | Ecosystem |
...

### 🐳 OS / Image packages (cannot fix in code)
| CVE | Severity | Package | Installed | Fixed in |
...
These require updating the container base image.

### Summary
- X HIGH/CRITICAL application vulns → will fix now
- Y MEDIUM/LOW application vulns → will offer to fix
- Z OS-level vulns → flagged only
```

## Step 4: Fix HIGH/CRITICAL application vulnerabilities

Apply fixes immediately after the report. Follow the ecosystem-specific rules below.

If there are no HIGH/CRITICAL application findings, state that clearly and skip to Step 5.

### Backend (Java/Gradle) fixes

Files to edit:

- `backend/gradle/libs.versions.toml`
- `backend/build.gradle.kts`

**How to override a transitive dependency:**

1. Add a pinned library entry in `[libraries]` in `libs.versions.toml`, with a `# <CVE-ID>` comment on the line above:

   ```toml
   # CVE-2025-12345
   some-library = "com.example:some-library:2.3.4"
   ```

2. Add `implementation(libs.<alias>)` to the `dependencies {}` block in `build.gradle.kts`, grouped near other CVE overrides.

Gradle's conflict-resolution (highest version wins) ensures the pinned version is used everywhere.

**If it's a direct dependency:** bump the version in `libs.versions.toml` directly instead.

**Version choice:** use the lowest fixed version that does NOT require a major upgrade. Prefer patch/minor bumps within the same major line.

**Alias naming:** convert `groupId:artifactId` to kebab-case, dropping the group prefix where redundant:

| Maven coordinate                                   | TOML alias            |
| -------------------------------------------------- | --------------------- |
| `io.netty:netty-codec-http2`                       | `netty-codec-http2`   |
| `org.apache.tomcat.embed:tomcat-embed-core`        | `tomcat-embed-core`   |
| `org.springframework.security:spring-security-web` | `spring-security-web` |

### Frontend (Node.js) fixes

**If it's a direct dependency:** update the version in `frontend/package.json` directly.

**If it's a transitive dependency:**

1. First try `pnpm up` (from the `frontend/` directory) — bumps all deps to their latest allowed version and often resolves transitive issues.
2. If the issue persists, add an override to `pnpm-workspace.yaml`:

   ```yaml
   overrides:
     some-package: "^2.3.2" # CVE-2025-12345
   ```
   Then run `pnpm install`.

**If the vulnerable package is bundled inside npm/pnpm itself** (path contains `npm/node_modules/` or `pnpm/node_modules/`): the app cannot fix this. Treat it like an OS-level finding — report it and note that it requires a newer npm/pnpm version in the base image.

## Step 5: Offer to fix MEDIUM/LOW application vulnerabilities

After completing (or skipping) Step 4, if there are MEDIUM or LOW application-level findings, ask:

> "I found [N] MEDIUM/LOW application vulnerabilities. Want me to fix those too?"

If the user says yes, apply the same ecosystem-specific fix logic from Step 4 to those findings.

Do not attempt to fix them automatically without asking first.

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

Run `./gradlew dependencies` and grep for the affected artifact to confirm the overridden version is resolved. Or rebuild and re-scan:

```bash
trivy image --format sarif --output trivy-results.sarif <image-tag>
```

### Frontend

```bash
# Check transitive deps in the lock file
cd frontend
trivy fs . --format sarif
# Or after building the image:
docker build .
trivy image <build-image-id> --format sarif
```

## How to distinguish OS vs. language vulnerabilities

The `name` field on each rule in the SARIF is authoritative:

- `OsPackageVulnerability` → Alpine/OS package, not fixable in code
- `LanguageSpecificPackageVulnerability` → app-level package (Java JAR, npm module, etc.)

The `locations[].physicalLocation.artifactLocation.uri` confirms the ecosystem and whether the package belongs to the app or to a bundled tool (npm, pnpm, etc.).
