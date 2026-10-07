# Sandbox

A container for coding agents working on this repo. Think of it as a helmet against accidents. The agent can't read your home directory or commit, and it runs in its own VM. It won't stop a determined attacker, and it doesn't try to.

It's based on [hello-sandbox](https://github.com/andreasphil/hello-sandbox). The [project-specific changes](#project-specific-changes) section lists what's different for this repo.

## Requirements

- Apple [container](https://github.com/apple/container) with the system service running. Start it with `container system start`.
- [mise](https://mise.jdx.dev) and `jq` on the host

## Usage

Run these from this folder, or from the repo root with `mise -C sandbox run <task>`:

```sh
mise run build     # build the image
mise run create    # create and start the container
mise run claude    # start Claude Code in auto mode, shift+tab switches to bypass
mise run shell     # open a shell as the developer user, --root for root
mise run stop      # stop the container, keeps its state
mise run start     # start it again
mise run recreate  # replace the container with a fresh one from the image, keeps volumes
mise run destroy   # delete the container and its volumes, keeps the shared Claude login
```

Log in the first time you start Claude. The login lives in `~/.local/share/sandbox-claude` on the host, shared by all sandboxes, so it survives `recreate` and `destroy`. Every sandbox can read it.

The backend downloads two public packages from GitHub Packages, which still requires a token. [backend/README.md](https://github.com/digitalservicebund/ris-search/blob/main/backend/README.md) explains why. The token only grants read access to public packages, so the sandbox keeps it in plain text in `~/.gradle/gradle.properties`, and the agent can download dependencies itself. Run this once after `create`. The token lives on the Gradle volume, so it survives `recreate`, but not `destroy`:

```sh
mise run backend-token   # reads the token from 1Password, writes it to the Gradle volume
```

`SANDBOX_GH_PACKAGES_TOKEN_REF` in [mise.toml](./mise.toml) holds the 1Password reference.

The agent starts services and dev servers itself, with the same commands you'd use on the host. [CLAUDE.sandbox.md](./CLAUDE.sandbox.md) lists them. On the host, open the frontend at <http://localhost:3000> and the backend at <http://localhost:8080>. The ports only listen on 127.0.0.1. They clash with the same services running on the host, so stop those first.

## What changes need what

| You changed…                                                            | Run                  |
| ----------------------------------------------------------------------- | -------------------- |
| `Dockerfile`, `entrypoint.sh`, `mise.sandbox.toml`, `CLAUDE.sandbox.md` | `build` + `recreate` |
| Ports, volumes, resources or the `create` task in `mise.toml`           | `recreate`           |
| Nothing, but you want the latest RIS CLI                                | `build` + `recreate` |
| Nothing (first time or after `destroy`)                                 | `build` + `create`   |

`build` looks up the latest commit of the RIS CLI on `main`, so it only rebuilds the RIS CLI when there's something new.

## What's in the sandbox

The [Dockerfile](./Dockerfile) installs:

- Java 25, Node and pnpm via mise. The build reads the Node and pnpm versions from `frontend/package.json`.
- Chromium for the Playwright version in `frontend/package.json`, and for `playwright-cli`
- Docker and Docker Compose, for OpenSearch and Testcontainers
- Python 3 from the Ubuntu packages
- Trivy via mise
- Claude Code, and `playwright-cli` with its skill
- The [RIS CLI](https://github.com/andreasphil/ris-cli) from the latest commit on `main`, with its skill

The skills live in `/etc/claude-code/.claude/skills`, where Claude loads them in every project. [CLAUDE.sandbox.md](./CLAUDE.sandbox.md) has agent instructions for the sandbox. Claude loads them on top of the repo's `CLAUDE.md`.

The sandbox ignores the repo's `mise.local.toml` because it's host-specific. The Dockerfile installs the sandbox's tools, and [mise.sandbox.toml](./mise.sandbox.toml) sets its environment variables.

## What the sandbox can access

| Path                                  | Access              | Notes                                                                                      |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| The repo                              | read/write          | mounted at the same path as on the host                                                    |
| `.git`                                | read-only           | commit on the host                                                                         |
| `ris-utils/ris-search`                | read-only           | targets of the repo's symlinks like `.claude` and `CLAUDE.md`, set in `SANDBOX_LINKED_DIR` |
| `frontend/node_modules`, `api-docs/…` | separate volumes    | Linux binaries, the host's `node_modules` stay as they are                                 |
| `~/.claude`                           | host folder         | Claude login and memory, shared by all sandboxes, set in `SANDBOX_CLAUDE_DIR`              |
| `~/.gradle`                           | volume              | Gradle cache and the GitHub Packages token                                                 |
| Rest of the host                      | none                | `create` copies in your global gitignore, nothing else                                     |
| Network                               | unrestricted egress |                                                                                            |

Some things to keep in mind:

- **The host enforces read-only mounts.** Even root in the VM can't write to `.git`. Don't run `mount -o remount` on the mounts, though. All bind mounts share one virtiofs filesystem, so remounting one of them read-only turns the whole repo read-only until the next restart.
- **Files the sandbox can change still run on the host.** `lefthook.yml`, `package.json` scripts and Gradle build files are the obvious ones. Review changes to them before you run anything on the host.
- **The container has all Linux capabilities.** Docker needs them. Every Apple container is its own VM, so this means root in the VM, not on the Mac. The developer user is in the `docker` group, which is also root-equivalent in the VM.
- **The agent sees everything in the repo folder.** Keep secrets in 1Password, not in files in the repo.

## What persists

| What                                                                                  | `stop`/`start` | `recreate` | `destroy` |
| ------------------------------------------------------------------------------------- | -------------- | ---------- | --------- |
| Container filesystem: installed packages, shell history, Docker images and containers | kept           | lost       | lost      |
| Volumes: Gradle cache and token, `node_modules`                                       | kept           | kept       | lost      |
| Shared Claude folder: login and memory                                                | kept           | kept       | kept      |
| Repo                                                                                  | kept           | kept       | kept      |

Anything you'll always need goes in the Dockerfile.

## Project-specific changes

- **Location:** the sandbox lives in `ris-utils/ris-search/sandbox` and is symlinked into the repo, like the other personal files. `SANDBOX_REPO` is set explicitly, and `create` mounts the linked folder read-only, so the symlinks resolve and the agent can't edit its own sandbox.
- **Versions:** Node, pnpm and Playwright come from `frontend/package.json` through build arguments, instead of from `mise.sandbox.toml`.
- **Java and Gradle:** Java 25 from the build's toolchain, a Gradle cache volume, and the `backend-token` task that stores the GitHub Packages token in it.
- **Docker:** dockerd runs inside the sandbox for OpenSearch and Testcontainers. This needs `--cap-add ALL`, an entrypoint that prepares the VM and runs dockerd instead of idling, and more time for `stop`.
- **Playwright:** the browsers are in the image instead of a volume, so E2E tests and `playwright-cli` work without an install step.
- **node_modules:** two volumes, for `frontend/` and `api-docs/`. The repo root has no `node_modules`.
- **mise:** the repo's `mise.local.toml` is ignored. `mise.sandbox.toml` copies the environment variables the sandbox needs from it and goes to `conf.d`, because the Dockerfile installs the tools with `mise use`.
- **Extra tools:** Python 3, Trivy, and the RIS CLI from git with its skill.
- **Ports and resources:** frontend, backend, Storybook, OpenSearch and OpenSearch Dashboards. 8 CPUs and 12 GB of memory.

## Quirks of Apple container

- Edits on the host don't trigger file watchers in the sandbox. Hot reload only picks up changes the agent makes. If you tweak something by hand, reload the page or restart the dev server.
- Bind mounts must be directories. That's why `create` copies the global gitignore in. It pipes the content through `container exec`, because `container cp` copies symlinks as links.
- `container machine` looked like the obvious fit, but its only filesystem option mounts your whole home directory, `~/.ssh` included.
- dockerd needs a writable `/proc/sys`, so the [entrypoint](./entrypoint.sh) remounts it before starting dockerd.
- `container stop` fails with errno 95 on `cgroup.kill` if dockerd created threaded cgroups. The entrypoint prevents that by moving all processes into a child cgroup first, like the `docker:dind` image does. `/run` is a tmpfs, so a failed stop can't leave a stale dockerd pid file behind.
