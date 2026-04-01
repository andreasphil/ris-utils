---
name: fix-backend-cves
description: Fix vulnerable Java/Gradle dependencies in the backend by pinning them in libs.versions.toml and build.gradle.kts, following the project's existing override pattern
license: MIT
compatibility: opencode
---

## What I do

Triage a vulnerability report for the backend Gradle project and patch HIGH and CRITICAL severity findings by forcing safe dependency versions — without major version upgrades wherever possible.

## Project structure

- `backend/gradle/libs.versions.toml` — central version catalog; the single source of truth for all pinned versions
- `backend/build.gradle.kts` — consumes the catalog; transitive overrides are applied by adding an explicit `implementation(libs.<alias>)` entry

## How the project overrides transitive dependencies

The project forces a specific version of a transitive dependency by:

1. Adding a pinned entry to `[libraries]` in `libs.versions.toml` with a CVE comment above it
2. Adding a corresponding `implementation(libs.<alias>)` line in the `dependencies {}` block of `build.gradle.kts`

Gradle's conflict-resolution (highest version wins) then ensures the pinned version is used everywhere in the dependency graph.

Existing examples to follow:

```toml
# CVE-2025-67735
netty-codec-http = "io.netty:netty-codec-http:4.2.10.Final"
# GHSA-72hv-8253-57qq
jackson-core = "com.fasterxml.jackson.core:jackson-core:2.21.2"
```

```kotlin
implementation(libs.netty.codec.http)
implementation(libs.jackson.core)
```

## Step-by-step workflow

1. **Filter**: only address HIGH and CRITICAL CVEs; skip MEDIUM and LOW.
2. **Identify origin**: determine whether the vulnerable package is:
   - An OS/Alpine package (from the container base image) — these cannot be fixed in Gradle; note this and skip
   - A direct Gradle dependency — bump it in `libs.versions.toml`
   - A transitive Gradle dependency — add an override entry following the pattern above
3. **Choose version**: use the lowest fixed version that does NOT require a major upgrade. Prefer patch or minor bumps within the same major line as the currently installed version.
4. **Edit `libs.versions.toml`**: add or update the library entry with a `# <CVE-ID>` comment on the line above.
5. **Edit `build.gradle.kts`**: if this is a new transitive override, add `implementation(libs.<alias>)` to the `dependencies {}` block, grouped near other CVE overrides.
6. **Do not touch**: OS-level packages (`giflib`, `libcrypto3`, `zlib`, etc.) — these require a container/Dockerfile change outside Gradle's scope. Flag them to the user instead.

## Alias naming convention

Convert the Maven `groupId:artifactId` to a TOML alias using kebab-case, dropping the group prefix where it would be redundant. Examples:

| Maven coordinate                                   | TOML alias            |
| -------------------------------------------------- | --------------------- |
| `io.netty:netty-codec-http2`                       | `netty-codec-http2`   |
| `org.apache.tomcat.embed:tomcat-embed-core`        | `tomcat-embed-core`   |
| `org.springframework.security:spring-security-web` | `spring-security-web` |

## What to tell the user when done

- List each CVE fixed, the artifact, the old version, and the new pinned version.
- List any CVEs skipped (with reason: severity below threshold, or OS-level package).
