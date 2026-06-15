# Allarounder dev container image.
# Base: Microsoft Python devcontainer (Debian bookworm) — gives us a non-root
# `vscode` user, build tooling, and a sane Python 3.13. Node is layered on via
# a devcontainer feature in devcontainer.json; uv/pnpm are installed below.
FROM mcr.microsoft.com/devcontainers/python:3-3.13-bookworm

# Avoid interactive prompts during image build.
ENV DEBIAN_FRONTEND=noninteractive

# System packages:
#   postgresql-client  -> psql for ad-hoc inspection of the Postgres service
#   Playwright runtime deps are installed via `playwright install-deps` in
#   postCreate (kept out of the image to stay version-aligned with the pinned
#   playwright package).
# The base image ships a Yarn apt source whose signing key has rotated, which
# makes `apt-get update` fail (NO_PUBKEY / "repository is not signed"). We use
# pnpm via corepack, not Yarn, so remove that source before updating.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# uv — fast Python package/venv manager. Installed to a shared location so both
# root and the vscode user can call it. UV_INSTALL_DIR tells the installer where
# to drop the binary.
ENV UV_INSTALL_DIR=/usr/local/bin
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && uv --version

# pnpm via corepack (corepack ships with the Node feature). Enabled in
# postCreate so it binds to the feature-provided Node.

USER vscode
