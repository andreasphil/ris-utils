---
name: maintain-cves
description: Audit existing CVE pins, overrides, and ignores across the project and remove any that are no longer needed because the vulnerability has been fixed upstream. Covers backend (Gradle pins and .trivyignore), frontend (pnpm overrides and .trivyignore), and api-docs (pnpm overrides and .trivyignore).
---

## What I do

Dependencies that were pinned or ignored because of a CVE eventually get fixed upstream. Left in place, those pins and ignores become dead weight that obscures the true state of the project. This skill finds every existing CVE mitigation, checks whether each is still necessary, and removes the stale ones. It is the inverse of `triage-cves`, which adds them.

Important: while we only gate CI on HIGH and CRITICAL, do not remove a mitigation if doing so re-introduces a CVE of **any** severity, including MEDIUM and LOW.

Discovery and the remove→rebuild→compare→restore-or-drop loop are scripted (`scripts/`) — the only judgment call left is asking before deleting a pnpm override that isn't CVE-related.

## Step 1: Find all existing CVE mitigations

Run:

```bash
bash .claude/skills/maintain-cves/scripts/audit.sh
```

This lists every candidate across all six locations (backend `libs.versions.toml` pins + their matching `build.gradle.kts` lines, all three `.trivyignore` files, and both `pnpm-workspace.yaml` `overrides:` blocks), and separately flags any pnpm override entry that has no `# CVE-`/`# GHSA-` comment — those need to be asked about before removal (see Notes). Most locations are usually empty; the script's output makes that immediately obvious rather than something you need to check file-by-file.

## Step 2: Check whether each candidate is still needed

For each candidate `audit.sh` lists, run `scripts/verify-pin.sh` with the mode matching its location. It handles the whole remove → rebuild/rescan → compare → restore-or-drop cycle and leaves the tree in the correct state on exit (removed if no longer needed, restored if still needed). It's slow (real gradle/pnpm/docker/trivy runs), so expect each candidate to take a while.

```bash
# backend/gradle/libs.versions.toml pins
bash .claude/skills/maintain-cves/scripts/verify-pin.sh backend <alias>

# frontend or api-docs pnpm overrides (api-docs has no fs scan — use `ignore` mode
# against the built image instead, see below)
bash .claude/skills/maintain-cves/scripts/verify-pin.sh pnpm <frontend|api-docs> <package>

# any of the three .trivyignore files
bash .claude/skills/maintain-cves/scripts/verify-pin.sh ignore <frontend|backend|api-docs> <cve-id>
```

It prints `DROP — ...` or `KEEP — ...` with the resolved version/scan result it observed — that line is exactly what Step 3's report needs.

### What each mode does, for troubleshooting

**`backend <alias>`**: removes the toml pin + its `build.gradle.kts` line (via `remove-pin.js`, so the file edits stay structurally correct), then runs

```bash
./gradlew dependencies --configuration productionRuntimeClasspath --write-locks | grep -i <artifact-name>
```

`productionRuntimeClasspath` is what `bootJar` packs into `BOOT-INF/lib`, i.e. exactly what the image scan sees. **`gradle.lockfile` pins every version independently of `libs.versions.toml`** (`dependencyLocking { lockAllConfigurations() }`), so without `--write-locks` the lockfile still injects the old version as a `{strictly <old>}` constraint and prints misleading lines like:

```
+--- io.netty:netty-codec-http:{strictly 4.2.17.Final} -> 4.2.15.Final (c)
\--- io.netty:netty-codec-http:4.2.17.Final FAILED
```

That still exits `BUILD SUCCESSFUL` — a naive read sees the old pinned version and wrongly concludes the pin is still needed. The script passes `--write-locks` and retries once if it still sees `FAILED`/`{strictly...}`; if that persists it restores the pin and asks for a manual check rather than guessing. The script finishes with a full `./gradlew :dependencies --write-locks` regeneration (a single `--configuration` run only rewrites that one configuration and leaves the lockfile internally inconsistent) — check `git diff --stat backend/gradle.lockfile` afterward. If you abandon the audit partway, `git checkout -- backend/gradle.lockfile backend/gradle/libs.versions.toml backend/build.gradle.kts` restores everything.

**`pnpm <project> <package>`**: removes the override (via `remove-pin.js`), runs `pnpm install`, then reproduces CI's source scan:

```bash
trivy fs . --skip-dirs node_modules --ignorefile .trivyignore --format table
```

(a bare `trivy fs .` would scan `node_modules` and bury the real findings in noise). Greps the scan output for the override's CVE ID (or the package name if the entry had no CVE comment). `api-docs/pnpm-workspace.yaml` has no `overrides:` block today — CI also runs no `fs` scan for api-docs, so if one gets added, verify it with `ignore` mode against the built image instead.

**`ignore <app> <cve-id>`**: removes the entry from `<app>/.trivyignore`, builds the image, and scans it:

```bash
docker build -t ris-<app>-check ./<app>
trivy image ris-<app>-check --format table
```

`frontend/.trivyignore` feeds **both** the frontend source scan and the frontend image scan — an entry that looks unnecessary in the image scan may still be suppressing a source-scan finding, so if this mode says DROP for a frontend entry, also re-check it against `pnpm` mode's `trivy fs` scan before removing it for good.

## Step 3: Report what changed

```md
## CVE maintenance summary

### Removed (no longer needed)
- `some-library` pin (CVE-2025-12345) — Spring Boot BOM now resolves 2.3.4
- `serialize-javascript` override — no longer flagged by the source scan
- CVE-2026-12345 from frontend/.trivyignore — absent from the image scan

### Kept (still needed)
- `netty-codec-http` pin (CVE-2026-55831) — resolves to 4.2.15.Final without the pin
- CVE-2026-59871 in frontend/.trivyignore — still present via npm's node-tar

### Not checked
- api-docs overrides / api-docs .trivyignore — empty, nothing to audit
```

State the resolved version/scan result `verify-pin.sh` actually observed for anything you kept — its DROP/KEEP output line has this. "Still needed" without a version is not verifiable later.

## Notes

- **Do the whole audit in one session** so the picture stays consistent, and leave the tree clean: either commit the removals or `git checkout --` the scratch edits.
- **Overrides and `.trivyignore` serve different purposes.** Overrides fix vulnerabilities in the app's own dependency graph; `.trivyignore` suppresses findings from the base image or from a package manager's bundled deps that app code cannot reach. Check them independently.
- **Don't remove a non-CVE override.** `audit.sh` flags any `pnpm-workspace.yaml` entry that has no `# CVE-`/`# GHSA-` comment. If removing one of those causes no CVE to reappear, it may still exist for compatibility or stability reasons — ask before deleting it.

## scripts/

- `audit.sh` — Step 1: lists every existing CVE mitigation across all six locations, and flags non-CVE pnpm overrides.
- `remove-pin.js backend --alias <alias>` / `remove-pin.js pnpm --project <frontend|api-docs> --package <name>` — structural removal of one entry (used internally by `verify-pin.sh`); prints the removed entry's CVE/version as JSON.
- `verify-pin.sh <backend|pnpm|ignore> ...` — Step 2: the full remove → rebuild/rescan → compare → restore-or-drop loop for one candidate.
