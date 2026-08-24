---
name: maintain-cves
description: Audit existing CVE pins, overrides, and ignores across the project and remove any that are no longer needed because the vulnerability has been fixed upstream. Covers backend (Gradle pins and .trivyignore), frontend (pnpm overrides and .trivyignore), and api-docs (pnpm overrides and .trivyignore).
---

## What I do

Dependencies that were pinned or ignored because of a CVE eventually get fixed upstream. Left in place, those pins and ignores become dead weight that obscures the true state of the project. This skill finds every existing CVE mitigation, checks whether each is still necessary, and removes the stale ones. It is the inverse of `triage-cves`, which adds them.

Important: while we only gate CI on HIGH and CRITICAL, do not remove a mitigation if doing so re-introduces a CVE of **any** severity, including MEDIUM and LOW.

## Step 1: Find all existing CVE mitigations

There are six places, but several are usually empty — check what's actually populated before planning work.

| # | Location | What counts as a candidate |
| - | -------- | -------------------------- |
| 1 | `backend/gradle/libs.versions.toml` | entries preceded by a `# CVE-` / `# GHSA-` comment |
| 2 | `backend/.trivyignore` | CVE IDs listed (header only = nothing to do) |
| 3 | `frontend/pnpm-workspace.yaml` | every entry under `overrides:` |
| 4 | `frontend/.trivyignore` | CVE IDs listed |
| 5 | `api-docs/pnpm-workspace.yaml` | every entry under `overrides:` (no such block today) |
| 6 | `api-docs/.trivyignore` | CVE IDs listed (header only = nothing to do) |

Start by listing what exists, so empty locations cost nothing:

```bash
grep -n -A1 '^# \(CVE\|GHSA\)' backend/gradle/libs.versions.toml
grep -c '^[A-Z]' backend/.trivyignore api-docs/.trivyignore frontend/.trivyignore
sed -n '/^overrides:/,/^$/p' frontend/pnpm-workspace.yaml api-docs/pnpm-workspace.yaml
```

For backend pins, note the matching `implementation(libs.<alias>)` line in `backend/build.gradle.kts` — it must be removed together with the toml entry. BOM pins appear as `implementation(platform(libs.<alias>))`.

The pnpm `overrides:` entries are not all CVE-related. Treat them all as candidates, but see the note at the bottom before deleting one that doesn't cause a CVE to reappear.

## Step 2: Check whether each is still needed

### Backend pins

The backend runs `dependencyLocking { lockAllConfigurations() }`, which changes how this check must be done. **`gradle.lockfile` pins every version independently of `libs.versions.toml`.** If you remove a pin and run a plain `dependencies` task, the lockfile still injects the old version as a `{strictly <old>}` constraint and the report prints misleading lines like:

```
+--- io.netty:netty-codec-http:{strictly 4.2.17.Final} -> 4.2.15.Final (c)
\--- io.netty:netty-codec-http:4.2.17.Final FAILED
```

That still exits `BUILD SUCCESSFUL`, and a naive grep for the artifact sees the old pinned version — so it looks like the pin is redundant when it isn't. Always pass `--write-locks` so lock state is refreshed before you read the resolved version.

For each pinned entry:

1. **Temporarily remove** both the toml entry (comment line + library line) and the `implementation(...)` line in `build.gradle.kts`.
2. Read the naturally-resolved version:

```bash
cd backend
./gradlew dependencies --configuration productionRuntimeClasspath --write-locks | grep -i <artifact-name>
```

Use `productionRuntimeClasspath`, not `runtimeClasspath` — it is what `bootJar` packs into `BOOT-INF/lib`, i.e. exactly what the image scan sees. (They differ only by `spring-boot-devtools` today, but the production one is the one that matters.)

3. If the resolved version is **≥ the previously pinned version**, the upstream BOM (usually Spring Boot) already picks up a safe version — drop the pin for good.
4. If it resolves lower, restore the pin and its `implementation(...)` line.
5. If any `FAILED` marker or `{strictly ...}` line still appears, the lock state didn't refresh — rerun with `--write-locks` before drawing a conclusion.

Because `--write-locks` rewrites `gradle.lockfile` as a side effect, finish with a full regeneration once all decisions are made, and confirm the diff only contains intended changes:

```bash
./gradlew :dependencies --write-locks
git diff --stat gradle.lockfile
```

Passing `--configuration` together with `--write-locks` only rewrites that one configuration, which leaves the lockfile internally inconsistent — the final full run above is what repairs it. If you abandon the audit partway, `git checkout -- gradle.lockfile gradle/libs.versions.toml build.gradle.kts` restores everything.

### Frontend overrides

1. Remove the entries under `overrides:` in `frontend/pnpm-workspace.yaml`. With only a handful of entries, removing them one at a time attributes findings more clearly than removing all at once.
2. Reproduce CI's source scan — the flags matter, since a bare `trivy fs .` scans `node_modules` and buries the real findings in noise:

```bash
cd frontend
pnpm install
trivy fs . --skip-dirs node_modules --ignorefile .trivyignore --format table
```

3. Any CVE that reappears needs its override restored. Add back only those entries.
4. Run `pnpm install` again after restoring to relock the correct versions.

### API docs overrides

`api-docs/pnpm-workspace.yaml` currently has no `overrides:` block, so there is normally nothing to check. If one has been added since, apply the frontend procedure with one difference: CI runs **no** `fs` scan for api-docs, so verify against the image scan below instead.

### Image ignores (`backend`, `frontend`, `api-docs`)

Same procedure for each; skip any file that contains only its header comment.

1. Remove the CVE entries from `<app>/.trivyignore`.
2. Build the image and scan it:

```bash
docker build -t ris-<app>-check ./<app>
trivy image ris-<app>-check --format table
```

3. Any CVE that reappears needs its ignore entry restored, keeping it under the comment that explains which bundled tool it comes from.

Note that `frontend/.trivyignore` feeds **both** the frontend source scan and the frontend image scan. An entry that looks unnecessary in the image scan may still be suppressing a source-scan finding, so check it against both before removing it.

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

State the resolved version you actually observed for anything you kept. "Still needed" without a version is not verifiable later.

## Notes

- **Do the whole audit in one session** so the picture stays consistent, and leave the tree clean: either commit the removals or `git checkout --` the scratch edits.
- **Overrides and `.trivyignore` serve different purposes.** Overrides fix vulnerabilities in the app's own dependency graph; `.trivyignore` suppresses findings from the base image or from a package manager's bundled deps that app code cannot reach. Check them independently.
- **Don't remove a non-CVE override.** If removing a `pnpm-workspace.yaml` entry causes no CVE to reappear, it may still exist for compatibility or stability reasons. Ask before deleting it.
