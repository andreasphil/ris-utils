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
- Path contains `npm/node_modules/` or `pnpm/node_modules/` (the package manager's own bundled deps, not the app's) → cannot be patched via app code

Also check `runs[].properties.imageName` to know which container image was scanned. Which scan produced the SARIF determines where a suppression would go:

| Scan | Defined in | Ignore file applied |
| ---- | ---------- | ------------------- |
| frontend source (`fs`, skips `node_modules`) | `frontend.yml` → `frontend-file-scan` | `frontend/.trivyignore` |
| frontend image | `scan-attest-sign-image.yml`, `app: frontend` | `frontend/.trivyignore` |
| backend image | `scan-attest-sign-image.yml`, `app: backend` | `backend/.trivyignore` |
| api-docs image | `scan-attest-sign-image.yml`, `app: api-docs` | `api-docs/.trivyignore` |

There is no source (`fs`) scan for backend or api-docs — those are image-scanned only.

## Step 3: Produce the triage report

Output the report inline in the conversation (no file written). Keep it proportional: for one or two findings a couple of lines is enough. Use the full grouped form only when there are many.

```
## Vulnerability Triage Report
Scanned image(s): <imageName(s)>

### HIGH / CRITICAL — Application (action required)
| CVE | Package | Installed | Fixed in | Ecosystem |

### MEDIUM / LOW — Application (fixable)
| CVE | Package | Installed | Fixed in | Ecosystem |

### OS / Image packages (cannot fix in code)
| CVE | Severity | Package | Installed | Fixed in |
These require updating the container base image.
```

## Step 4: Fix HIGH/CRITICAL application vulnerabilities

Apply fixes immediately after the report. Follow the ecosystem-specific rules below.

If there are no HIGH/CRITICAL application findings, state that clearly and skip to Step 5.

### Backend (Java/Gradle) fixes

Files to edit:

- `backend/gradle/libs.versions.toml`
- `backend/build.gradle.kts`

**How to override a transitive dependency:**

1. Add a pinned library entry at the end of `[libraries]` in `libs.versions.toml`, with a `# <CVE-ID>` comment on the line above. Use the table form with an inline `version` — not a `version.ref`, and not the `"group:artifact:version"` shorthand — so the pinned version sits next to its CVE comment:

```toml
# CVE-2026-55831
netty-codec-http = { module = "io.netty:netty-codec-http", version = "4.2.17.Final" }
```

2. Add the dependency to the `dependencies {}` block in `build.gradle.kts`, repeating the `// <CVE-ID>` comment, grouped with the other CVE overrides:

```kotlin
// CVE-2026-55831
implementation(libs.netty.codec.http)
```

Gradle's conflict-resolution (highest version wins) ensures the pinned version is used everywhere.

**If one CVE spans several artifacts from the same project, pin its BOM** instead of listing each artifact, and wrap it in `platform(...)`:

```toml
# CVE-2026-5588
bouncycastle-bom = { module = "org.bouncycastle:bc-jdk18on-bom", version = "1.85.2" }
```

```kotlin
// CVE-2026-5588
implementation(platform(libs.bouncycastle.bom))
```

**If it's a direct dependency:** bump the version in `libs.versions.toml` directly instead.

**Version choice:** use the lowest fixed version that does NOT require a major upgrade. Prefer patch/minor bumps within the same major line.

**Alias naming:** there is no strict rule — match the existing entries, which keep the artifactId and add just enough group context to stay unambiguous:

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

**If it's a direct dependency:** update the version in `frontend/package.json` or `api-docs/package.json` directly, depending on which scan flagged it. Both projects set `minimumReleaseAge`, so a very fresh release also needs an entry in that project's `minimumReleaseAgeExclude` list in `pnpm-workspace.yaml`.

**If it's a transitive dependency:**

1. First try `pnpm up` (from `frontend/` or `api-docs/`) — bumps all deps to their latest allowed version and often resolves transitive issues.
2. If the issue persists, add an override to that project's `pnpm-workspace.yaml`. `api-docs/pnpm-workspace.yaml` has no `overrides:` block yet — add one if it's needed there:

```yaml
overrides:
  some-package: "^2.3.2" # CVE-2025-12345
```

3. Then run `pnpm install`.

**If the vulnerable package is bundled inside npm/pnpm itself** (path contains `npm/node_modules/` or `pnpm/node_modules/`): the app cannot fix this. Treat it like an OS-level finding — report it, note that it needs a newer npm/pnpm in the base image, and add the CVE to the matching `.trivyignore` with a comment naming the bundling tool and why it's unreachable in production. Each ignore file already carries a header explaining that intent; keep new entries grouped under a matching comment.

Note that `frontend/.trivyignore` is passed to **both** the frontend source scan and the frontend image scan, so an entry there silences the CVE in both. Don't use it to paper over a finding the app could actually fix.

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
