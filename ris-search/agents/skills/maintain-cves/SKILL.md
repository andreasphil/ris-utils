---
name: maintain-cves
description: Audit existing CVE pins, overrides, and ignores across the project and remove any that are no longer needed because the vulnerability has been fixed upstream. Covers backend (Gradle), frontend (pnpm overrides), and frontend image (.trivyignore).
---

## What I do

Periodically, dependencies that were pinned or ignored due to CVEs get fixed upstream. Left in place, those pins and ignores become dead weight that obscures the true state of the project. This skill finds all existing CVE mitigations, checks whether each is still necessary, and removes the stale ones.

This is the complement to `triage-cves`: that skill _adds_ fixes when new vulnerabilities are found; this skill _removes_ fixes when vulnerabilities are resolved.

Important: While we mostly fix HIGH and CRITICAL CVEs, do not remove fixes if they re-introduce CVEs of any level, including MEDIUM and LOW severity CVEs.

## Step 1: Find all existing CVE mitigations

### Backend — `backend/gradle/libs.versions.toml`

Scan for lines preceded by a `# CVE-` or `# GHSA-` comment. These are explicit CVE overrides. Example:

```toml
# CVE-2025-12345
some-library = "com.example:some-library:2.3.4"
# GHSA-72hv-8253-57qq
jackson-core = "com.fasterxml.jackson.core:jackson-core:2.21.2"
```

Also note the corresponding `implementation(libs.<alias>)` lines in `backend/build.gradle.kts` — these must be removed together with the toml entries.

### Frontend overrides — `frontend/pnpm-workspace.yaml`

All entries in the `overrides:` block are candidates. Not all have CVE comments, but treat them all as candidates since there's no reliable way to distinguish CVE pins from other intentional version locks without testing.

### Frontend image ignores — `frontend/.trivyignore`

All CVE IDs listed here. The comment at the top of the file explains the intent: these are CVEs that appear in the container image (e.g. bundled inside npm/pnpm itself) and cannot be resolved via the app's own dependencies.

---

## Step 2: Check whether each is still needed

### Backend

For each pinned entry in `libs.versions.toml`:

1. **Temporarily remove** the pinned entry (the comment line and the library line).
2. Run:
   ```bash
   cd backend
   ./gradlew dependencies --configuration runtimeClasspath | grep -i <artifact-name>
   ```
3. If the naturally-resolved version is **≥ the previously pinned fixed version**, the upstream BOM (e.g. Spring Boot) has already picked up a safe version — the override is no longer needed.
4. If the resolved version would still be vulnerable, restore the pin.
5. Also remove the corresponding `implementation(libs.<alias>)` line from `build.gradle.kts` when removing a pin.

### Frontend overrides

1. Remove **all** entries from the `overrides:` block in `pnpm-workspace.yaml`.
2. Run:
   ```bash
   cd frontend
   pnpm install
   trivy fs . --format table
   ```
3. Any CVE that reappears needs its override restored. Add back only those entries.
4. Run `pnpm install` again after restoring overrides to lock the correct versions.

### Frontend image ignores

1. Remove **all** entries from `frontend/.trivyignore`.
2. Build the frontend image:
   ```bash
   cd frontend
   docker build .
   trivy image <build-image-id> --format table
   ```
3. Any CVE that reappears needs its ignore entry restored. Add back only those entries.

---

## Step 3: Report what changed

After completing the audit, output a summary:

```
## CVE maintenance summary

### Removed (no longer needed)
- `some-library` pin (CVE-2025-12345) — upstream resolved in Spring Boot BOM
- `serialize-javascript` override — no longer flagged by trivy fs
- CVE-2026-12345 .trivyignore entry — no longer present in image scan

### Kept (still needed)
- `jackson-core` pin (GHSA-72hv-8253-57qq) — still resolved at vulnerable version without pin
- `fast-xml-parser` override — CVE still appears without override
- CVE-2026-99999 .trivyignore entry — still present in image scan

### No change
- X entries checked, none changed
```

---

## Notes

- **Do all three checks in one session** — this gives a consistent picture of what's needed.
- **Frontend overrides and .trivyignore serve different purposes**: overrides fix vulnerabilities in the _app_; .trivyignore suppresses findings from npm/pnpm's own bundled dependencies that can't be fixed in app code. Check them independently.
- **Don't remove overrides that aren't CVE-related** — if a `pnpm-workspace.yaml` override entry doesn't cause a CVE reappearance when removed but you're unsure if it was added for other reasons (compatibility, stability), ask before removing it.
