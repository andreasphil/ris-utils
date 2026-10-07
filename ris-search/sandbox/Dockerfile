FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# without a UTF-8 locale, java breaks on non-ascii filenames
ENV LANG=C.UTF-8

# install system-level dependencies
#
# - ca-certificates, curl, gnupg2 for loading and verifying dependencies via mise
# - docker.io, docker-compose-v2 for OpenSearch and Testcontainers. dockerd runs
#   inside the sandbox, see entrypoint.sh
# - docker-buildx for building images, the legacy builder is deprecated
# - git to inspect history. .git is read-only, so no commits
# - jq for the license scripts
# - libatomic1 is required by node
# - python3 for scripts
# - vim, less, procps, iproute2 for looking around
RUN apt-get update \
  && apt-get -y --no-install-recommends install \
  ca-certificates \
  curl \
  docker-buildx \
  docker-compose-v2 \
  docker.io \
  git \
  gnupg2 \
  iproute2 \
  jq \
  less \
  libatomic1 \
  procps \
  python3 \
  vim \
  && rm -rf /var/lib/apt/lists/*

# replace the default ubuntu user, uid 1000, with our developer account. it's
# in the docker group, which makes it root-equivalent inside the VM. that's
# fine. the VM boundary and the mounts protect the host.
RUN userdel -r ubuntu \
  && useradd -m -u 1000 -G docker -s /bin/bash developer

# shared browser location so the developer can install browsers without root
ENV PLAYWRIGHT_BROWSERS_PATH="/opt/playwright"
RUN install -d -o developer -g developer $PLAYWRIGHT_BROWSERS_PATH

USER developer
WORKDIR /home/developer

# the layers below go from rarely to often changing, so a version bump or a
# config edit doesn't re-download everything before it

# claude code. CLAUDE_CONFIG_DIR points to a folder on the host shared by all
# sandboxes, so you log in once and the login survives recreating the container.
ENV PATH="/home/developer/.local/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV CLAUDE_CONFIG_DIR="/home/developer/.claude"

# files in bind mounts look root-owned, and git refuses to work with them
# unless we mark them safe. `mise run create` copies the global gitignore to
# git's default location, ~/.config/git/ignore.
RUN git config --global safe.directory '*'

# mise for runtimes and tools. shims on PATH make the tools available in
# non-interactive `container exec` calls, too.
ENV PATH="/home/developer/.local/share/mise/shims:$PATH"
RUN curl -fsSL https://mise.run | sh
RUN mise use --global java@25
ENV JAVA_HOME="/home/developer/.local/share/mise/installs/java/25"

# trivy to scan dependencies for vulnerabilities, like CI does
RUN mise use --global trivy@latest

# node and pnpm with the versions from frontend/package.json. playwright-cli
# needs node, so it comes after.
ARG NODE_VERSION
ARG PNPM_VERSION
RUN test -n "$NODE_VERSION" && test -n "$PNPM_VERSION" \
  && mise use --global "node@$NODE_VERSION" "pnpm@$PNPM_VERSION" npm:@playwright/cli@latest

# otherwise pnpm uses the host's .pnpm-store in the repo, which has macOS
# binaries in it
ENV PNPM_CONFIG_STORE_DIR="/home/developer/.local/share/pnpm/store"

# playwright browsers, in the image so they survive recreating the container:
# chromium for E2E tests, pinned to the version in frontend/package.json, and
# chromium for playwright-cli, which may use a different playwright version
ARG PLAYWRIGHT_VERSION
RUN test -n "$PLAYWRIGHT_VERSION" \
  && pnpx "playwright@$PLAYWRIGHT_VERSION" install chromium \
  && playwright-cli install-browser chromium

# system libraries for chromium need root. root runs the developer's tools
# through mise, with a throwaway pnpm store so no root-owned files end up in
# the developer's home.
USER root
RUN MISE_CONFIG_DIR=/home/developer/.config/mise \
  MISE_DATA_DIR=/home/developer/.local/share/mise \
  PNPM_CONFIG_STORE_DIR=/tmp/pnpm-store \
  mise exec -- pnpx "playwright@$PLAYWRIGHT_VERSION" install-deps chromium \
  && rm -rf /var/lib/apt/lists/* /tmp/pnpm-store /root/.cache /root/.local

# ris cli at the commit of main that the build task looked up. a new commit
# changes the argument, which rebuilds this layer and the ones after it.
USER developer
ARG RIS_CLI_COMMIT
RUN test -n "$RIS_CLI_COMMIT" \
  && git clone https://github.com/andreasphil/ris-cli.git /home/developer/.local/share/ris-cli \
  && cd /home/developer/.local/share/ris-cli \
  && git checkout --quiet "$RIS_CLI_COMMIT" \
  && pnpm install --frozen-lockfile \
  && pnpm build \
  && ln -s /home/developer/.local/share/ris-cli/bin/ris.mjs /home/developer/.local/bin/ris

# skills for playwright-cli and the ris cli. they go in the managed settings
# folder, because the shared ~/.claude mount hides anything the image puts
# there, and the repo's .claude is read-only. playwright-cli writes to the
# current folder, so both write to a temporary one first.
RUN mkdir /tmp/skills && cd /tmp/skills \
  && PLAYWRIGHT_MCP_BROWSER=chromium playwright-cli install --skills \
  && ris skill install
USER root
RUN mkdir -p /etc/claude-code/.claude \
  && mv /tmp/skills/.claude/skills /etc/claude-code/.claude/skills \
  && rm -rf /tmp/skills

# config files last, they change most often
COPY --chown=developer:developer mise.sandbox.toml /home/developer/.config/mise/conf.d/sandbox.toml
# agent instructions for the sandbox. claude loads them on top of the repo's CLAUDE.md
COPY CLAUDE.sandbox.md /etc/claude-code/CLAUDE.md
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
# the entrypoint prepares the VM as root, see entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
