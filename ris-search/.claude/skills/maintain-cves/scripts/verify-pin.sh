#!/usr/bin/env bash
# maintain-cves Step 2: check whether one existing CVE mitigation is still
# needed, by temporarily removing it and re-checking with the real tool
# (gradle / trivy). Restores automatically if the CVE reappears.
#
# Run from the ris-search repo root. MUTATES the working tree while running
# (backed up and restored), and runs a real gradle/pnpm/docker+trivy command,
# so it is slow. Leaves the tree in the "safe to keep" state on exit:
# removed if no longer needed, restored if still needed.
#
# File edits are delegated to remove-pin.js (structural TOML/Gradle/YAML
# editing) — this script only orchestrates backup/restore and the
# build/scan/compare loop.
#
# Usage:
#   verify-pin.sh backend <alias>
#   verify-pin.sh pnpm <frontend|api-docs> <package>
#   verify-pin.sh ignore <frontend|backend|api-docs> <cve-id>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mode="${1:?mode required: backend|pnpm|ignore}"

# Prints: lt | ge  (best-effort dotted-numeric compare; suffixes like
# "Final" are ignored, so "4.2.15.Final" compares as "4.2.15")
cmp_versions() {
  local a="$1" b="$2"
  local a_num b_num
  a_num=$(grep -oE '^[0-9]+(\.[0-9]+)*' <<<"$a")
  b_num=$(grep -oE '^[0-9]+(\.[0-9]+)*' <<<"$b")
  if [[ -z "$a_num" || -z "$b_num" ]]; then echo unknown; return; fi
  if [[ "$a_num" == "$b_num" ]]; then echo ge; return; fi
  if [[ "$(printf '%s\n%s\n' "$a_num" "$b_num" | sort -V | head -1)" == "$a_num" ]]; then
    echo lt
  else
    echo ge
  fi
}

# Prints one field of the JSON remove-pin.js emits. Missing/null fields print
# as an empty string (a bare console.log(null) would print "null").
json_field() {
  node -e "console.log(JSON.parse(process.argv[1])[process.argv[2]] ?? '')" "$1" "$2"
}

# Prints "artifact version" for every artifact of the given Maven group on
# productionRuntimeClasspath, using the version Gradle actually resolved (the
# part after "->"). Skips the BOM itself, since a BOM never shows up as a
# resolved artifact once it's removed. Prints FAILED if any line of the group
# failed to resolve.
resolve_group() {
  local group="$1"
  local out
  out=$(cd backend && ./gradlew dependencies --configuration productionRuntimeClasspath --write-locks 2>/dev/null || true)
  if grep -F "$group:" <<<"$out" | grep -q FAILED; then
    echo FAILED
    return
  fi
  awk -v g="$group:" '
    index($0, g) {
      s = substr($0, index($0, g) + length(g))
      sub(/ \([a-z*]\)$/, "", s)
      artifact = s; sub(/:.*/, "", artifact)
      if (artifact ~ /-bom$/) next
      v = s
      if (s ~ / -> /) sub(/.* -> /, "", v); else sub(/^[^:]*:/, "", v)
      if (v ~ /[{\[(]/) next
      print artifact, v
    }' <<<"$out" | sort -k1,1 -k2,2V | awk '{ last[$1] = $2 } END { for (a in last) print a, last[a] }' | sort
}

case "$mode" in
backend)
  alias_="${2:?alias required, e.g. bouncycastle-bom}"
  toml=backend/gradle/libs.versions.toml
  kts=backend/build.gradle.kts

  # A BOM pin has no artifact of its own in the dependency tree, so check the
  # artifacts it manages instead: record what the BOM's group resolves to
  # with the pin, then compare after removing it.
  is_bom=false
  if grep -qF "platform(libs.${alias_//-/.})" "$kts"; then is_bom=true; fi
  if [[ "$is_bom" == true ]]; then
    bom_module=$(grep -E "^${alias_} = " "$toml" | grep -oE 'module *= *"[^"]+"' | cut -d'"' -f2)
    group="${bom_module%%:*}"
    echo "BOM pin — recording resolved $group artifacts with the pin"
    baseline=$(resolve_group "$group")
    echo "$baseline"
  fi

  cp "$toml" "$toml.bak"
  cp "$kts" "$kts.bak"
  restore() { mv -f "$toml.bak" "$toml"; mv -f "$kts.bak" "$kts"; }
  trap restore ERR

  removed_json=$(node "$SCRIPT_DIR/remove-pin.js" backend --alias "$alias_")
  cve=$(json_field "$removed_json" cve)
  module_=$(json_field "$removed_json" module)
  pinned_version=$(json_field "$removed_json" version)
  artifact="${module_#*:}"
  echo "Checking $alias_ ($module_, pinned at $pinned_version, $cve)"

  if [[ "$is_bom" == true ]]; then
    after=$(resolve_group "$group")
    echo "Resolved without the pin:"
    echo "$after"

    downgraded=""
    if [[ "$baseline" == FAILED || "$after" == FAILED || -z "$after" ]]; then
      downgraded="(could not resolve $group cleanly)"
    fi
    while read -r name pinned_ver; do
      [[ -z "$name" || "$name" == FAILED ]] && continue
      new_ver=$(awk -v a="$name" '$1 == a { print $2 }' <<<"$after")
      # An artifact that disappears entirely is no longer shipped, so it's fine.
      [[ -z "$new_ver" ]] && continue
      if [[ "$(cmp_versions "$new_ver" "$pinned_ver")" != "ge" ]]; then
        downgraded+=" $name:$pinned_ver->$new_ver"
      fi
    done <<<"$baseline"

    if [[ -z "$downgraded" ]]; then
      echo "DROP — no $group artifact resolves lower without the BOM pin."
      rm -f "$toml.bak" "$kts.bak"
    else
      echo "KEEP — without the BOM pin:$downgraded"
      restore
    fi
    trap - ERR
    (cd backend && ./gradlew :dependencies --write-locks >/dev/null 2>&1)
    echo "Full lockfile regenerated. Check: git diff --stat backend/gradle.lockfile"
    exit 0
  fi

  echo "Running: cd backend && ./gradlew dependencies --configuration productionRuntimeClasspath --write-locks | grep -i $artifact"
  # A "{strictly ...}"/FAILED line means the lockfile hasn't refreshed yet
  # (see maintain-cves SKILL.md) — rerun once before giving up.
  # If the artifact appears in more than one configuration branch, only the
  # first match is used — review the full output manually if that's a concern.
  resolved_line=""
  for attempt in 1 2; do
    resolved_line=$(cd backend && ./gradlew dependencies --configuration productionRuntimeClasspath --write-locks 2>/dev/null | grep -i "$artifact" | head -1 || true)
    if [[ -n "$resolved_line" && "$resolved_line" != *FAILED* && "$resolved_line" != *strictly* ]]; then
      break
    fi
  done
  echo "Resolved: $resolved_line"

  if [[ "$resolved_line" == *FAILED* || "$resolved_line" == *strictly* || -z "$resolved_line" ]]; then
    echo "Could not confirm a clean resolved version after retrying — restoring pin, needs manual check."
    restore
    (cd backend && ./gradlew :dependencies --write-locks >/dev/null 2>&1)
    exit 1
  fi

  # Line shape is "group:artifact:version" or "group:artifact:{strictly X} -> version"
  trimmed="${resolved_line%% (*}"
  if [[ "$trimmed" == *" -> "* ]]; then
    resolved_version="${trimmed##* -> }"
  else
    resolved_version="${trimmed##*:}"
  fi

  decision=$(cmp_versions "$resolved_version" "$pinned_version")
  if [[ "$decision" == "ge" ]]; then
    echo "DROP — resolves to $resolved_version without the pin (>= pinned $pinned_version)."
    rm -f "$toml.bak" "$kts.bak"
  else
    echo "KEEP — resolves to $resolved_version without the pin (< pinned $pinned_version, or comparison was inconclusive)."
    restore
  fi
  trap - ERR
  (cd backend && ./gradlew :dependencies --write-locks >/dev/null 2>&1)
  echo "Full lockfile regenerated. Check: git diff --stat backend/gradle.lockfile"
  ;;

pnpm)
  project="${2:?project required: frontend|api-docs}"
  pkg="${3:?package required}"
  yaml="$project/pnpm-workspace.yaml"

  cp "$yaml" "$yaml.bak"
  restore() { mv -f "$yaml.bak" "$yaml"; }
  trap restore ERR

  removed_json=$(node "$SCRIPT_DIR/remove-pin.js" pnpm --project "$project" --package "$pkg")
  cve=$(json_field "$removed_json" cve)
  echo "Checking override for $pkg in $project (${cve:-no CVE comment on this entry})"

  (cd "$project" && pnpm install >/dev/null)

  if [[ "$project" == "frontend" ]]; then
    scan_out=$(cd frontend && trivy fs . --skip-dirs node_modules --ignorefile .trivyignore --format table 2>/dev/null || true)
  else
    echo "api-docs has no source (fs) scan in CI — verify with 'ignore' mode against the built image instead." >&2
    restore
    trap - ERR
    exit 1
  fi

  needle="${cve:-$pkg}"
  if [[ -n "$needle" ]] && grep -q "$needle" <<<"$scan_out"; then
    echo "KEEP — $needle still present in $project without the override."
    restore
    (cd "$project" && pnpm install >/dev/null)
  else
    echo "DROP — $needle does not reappear in $project without the override."
    rm -f "$yaml.bak"
  fi
  trap - ERR
  ;;

ignore)
  app="${2:?app required: frontend|backend|api-docs}"
  cve="${3:?cve id required}"
  file="$app/.trivyignore"

  cp "$file" "$file.bak"
  restore() { mv -f "$file.bak" "$file"; }
  trap restore ERR

  # Removes the entry's line. If that leaves its group empty (the comment
  # lines directly above it, with a blank line or EOF below), removes those
  # comments and the blank line separating the group from the previous one.
  awk -v cve="$cve" '
    { line[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) {
        trimmed = line[i]
        gsub(/^[ \t]+|[ \t]+$/, "", trimmed)
        if (trimmed == cve) idx = i
      }
      from = idx; to = idx
      next_empty = (idx == NR || line[idx + 1] == "")
      prev_is_entry = (idx > 1 && line[idx - 1] != "" && line[idx - 1] !~ /^#/)
      if (idx && next_empty && !prev_is_entry) {
        while (from > 1 && line[from - 1] ~ /^#/) from--
        if (from > 1 && line[from - 1] == "") from--
      }
      for (i = 1; i <= NR; i++) if (!idx || i < from || i > to) print line[i]
    }' "$file" > "$file.tmp"
  mv "$file.tmp" "$file"

  # BuildKit writes its progress to stderr
  docker build -t "ris-${app}-verify" "./$app" >/dev/null 2>&1
  scan_out=$(trivy image "ris-${app}-verify" --format table 2>/dev/null || true)

  if grep -q "$cve" <<<"$scan_out"; then
    echo "KEEP — $cve still present in the $app image without the ignore entry."
    restore
  else
    echo "DROP — $cve does not reappear in the $app image without the ignore entry."
    rm -f "$file.bak"
  fi
  trap - ERR
  ;;

*)
  echo "Unknown mode: $mode (expected backend|pnpm|ignore)" >&2
  exit 1
  ;;
esac
