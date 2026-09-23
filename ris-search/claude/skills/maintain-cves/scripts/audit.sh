#!/usr/bin/env bash
# maintain-cves Step 1: list every existing CVE mitigation across the repo.
# Run from the ris-search repo root. Read-only — makes no changes.
set -euo pipefail

echo "## 1. backend/gradle/libs.versions.toml pins"
if grep -qE '^# (CVE-|GHSA-)' backend/gradle/libs.versions.toml; then
  grep -n -A1 -E '^# (CVE-|GHSA-)' backend/gradle/libs.versions.toml
else
  echo "(none)"
fi

echo
echo "## 2. backend/.trivyignore entries"
if grep -qE '^(CVE-|GHSA-)' backend/.trivyignore; then
  grep -n -B1 -E '^(CVE-|GHSA-)' backend/.trivyignore
else
  echo "(none — header only)"
fi

echo
echo "## 3. frontend/pnpm-workspace.yaml overrides"
if sed -n '/^overrides:/,/^[^ ]/p' frontend/pnpm-workspace.yaml | grep -qE '^\s+\S'; then
  sed -n '/^overrides:/,/^[^ ]/p' frontend/pnpm-workspace.yaml
else
  echo "(none)"
fi

echo
echo "## 4. frontend/.trivyignore entries"
if grep -qE '^(CVE-|GHSA-)' frontend/.trivyignore; then
  grep -n -B1 -E '^(CVE-|GHSA-)' frontend/.trivyignore
else
  echo "(none — header only)"
fi

echo
echo "## 5. api-docs/pnpm-workspace.yaml overrides"
if grep -q '^overrides:' api-docs/pnpm-workspace.yaml 2>/dev/null && sed -n '/^overrides:/,/^[^ ]/p' api-docs/pnpm-workspace.yaml | grep -qE '^\s+\S'; then
  sed -n '/^overrides:/,/^[^ ]/p' api-docs/pnpm-workspace.yaml
else
  echo "(none — no overrides: block)"
fi

echo
echo "## 6. api-docs/.trivyignore entries"
if grep -qE '^(CVE-|GHSA-)' api-docs/.trivyignore; then
  grep -n -B1 -E '^(CVE-|GHSA-)' api-docs/.trivyignore
else
  echo "(none — header only)"
fi

echo
echo "## Backend pins: matching build.gradle.kts implementation(...) lines"
echo "(cross-check — each toml pin above must have a matching entry here, removed together)"
grep -n -A1 -E '^\s*// (CVE-|GHSA-)' backend/build.gradle.kts || echo "(none)"

echo
echo "## Non-CVE pnpm overrides (flagged — do not remove without asking, see maintain-cves SKILL.md)"
for f in frontend/pnpm-workspace.yaml api-docs/pnpm-workspace.yaml; do
  sed -n '/^overrides:/,/^[^ ]/p' "$f" 2>/dev/null | grep -E '^\s+\S+:' | grep -v '#\s*\(CVE-\|GHSA-\)' | sed "s|^|  $f: |" || true
done
