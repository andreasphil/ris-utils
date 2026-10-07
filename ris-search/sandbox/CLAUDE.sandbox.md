# Sandbox

You are running inside a sandbox container (see `sandbox/README.md` in the repo). This changes some of the project instructions:

- Unlike what the project CLAUDE.md says, start services yourself when you need them instead of asking. The dev servers aren't running when you start. OpenSearch comes back on its own when the sandbox restarts, if it was running before. The commands below are safe to run either way. Run long-running servers in the background:
  - OpenSearch: `docker compose up -d --wait` in the repo root
  - Backend with E2E test data: `./gradlew bootRun --args='--spring.profiles.active=default,e2e'` in `backend/`
  - Frontend: `pnpm dev` in `frontend/`
- Docker is available, so backend integration tests (Testcontainers) work. They are CPU-heavy: stop OpenSearch (`docker compose stop`) before long test runs, it slows them down a lot.
- The backend downloads two packages from GitHub Packages. The token for them is in `~/.gradle/gradle.properties`. If Gradle fails with 401 on `maven.pkg.github.com`, the token is missing: ask the user to run `mise run backend-token` on the host.
- Trivy is installed for vulnerability scans.
- `build/` folders are shared with the host, so Gradle may skip tests the host already ran. Use `--rerun-tasks` when you need a real run.
- `.git` is mounted read-only. You can inspect history, diffs and branches, but you can't commit, switch branches, or stash. Leave committing to the user.
- Don't push, pull, or fetch. The sandbox has no Git credentials, so these fail.
- `.claude/`, `CLAUDE.md` and `sandbox/` are symlinks to a read-only folder. Your memory lives in your own config directory.
- Files the user edits on the host don't trigger file watchers in here. Your own edits do.
- `frontend/node_modules` and `api-docs/node_modules` are separate from the host. Run `pnpm install` here if they are missing or outdated; this doesn't affect the host.
- The user reaches the dev servers from the host via published ports: 3000 (frontend), 8080 (backend), 6006 (Storybook), 9200 (OpenSearch), 5601 (OpenSearch Dashboards).
- You can't install system packages (no root). If a tool is missing, tell the user so they can add it to `sandbox/Dockerfile`.
- Chromium is installed for both the E2E tests and `playwright-cli`, so you don't need to install browsers.
- The sandbox only has the Chromium browser for Playwright. Firefox, WebKit and the `mobile` project fail at launch ("Executable doesn't exist at /opt/playwright/firefox-…" / "…/webkit-…/pw_run.sh"), so none of their tests run. The `smoke-tests` project targets staging and isn't part of local verification either. Mobile-only tests (`test.skip(!isMobileTest)`) are skipped on Chromium, so changes to test data or small-screen UI can break them unnoticed. Workaround: a temporary config in the untracked `frontend/.playwright-cli/` folder. It imports `../playwright.config` and defines one project that must be named `mobile` (the `isMobileTest` fixture checks the name): Desktop Chrome, viewport 320×600, `hasTouch`. Run it with `-c`, then delete the file.
