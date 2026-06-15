#!/usr/bin/env bash
# Runs once after the container is created. Idempotent: safe to re-run.
# Because src/ does not exist yet, dependency installs are guarded — this
# script bootstraps tooling now and wires up the apps when they appear.
set -euo pipefail

echo "==> Enabling pnpm via corepack"
# The corepack bundled with the Node 20 feature ships stale package-manager
# signing keys, so `corepack prepare pnpm@latest` fails signature verification
# ("Cannot find matching keyid") while populating ~/.cache/node/corepack.
# Upgrading corepack to latest refreshes the keys before we fetch pnpm.
sudo npm install -g corepack@latest
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version

echo "==> Installing Playwright system dependencies"
# Browsers + their OS deps for frontend E2E. `--with-deps` happens at the
# project level later; here we just ensure the apt libs are present.
sudo npx --yes playwright install-deps || \
  echo "WARN: playwright install-deps failed (will retry at project setup)"

# --- Backend (FastAPI) -----------------------------------------------------
if [ -f "src/backend/pyproject.toml" ]; then
  echo "==> Setting up backend venv with uv"
  ( cd src/backend && uv sync )
else
  echo "==> Skipping backend setup (src/backend/pyproject.toml not found yet)"
fi

# --- Frontend (Next.js) ----------------------------------------------------
if [ -f "src/frontend/package.json" ]; then
  echo "==> Installing frontend deps with pnpm"
  ( cd src/frontend && pnpm install )
else
  echo "==> Skipping frontend setup (src/frontend/package.json not found yet)"
fi

echo "==> Tool versions"
echo "python: $(python --version)"
echo "uv:     $(uv --version)"
echo "node:   $(node --version)"
echo "pnpm:   $(pnpm --version)"
echo "az:     $(az version --query '\"azure-cli\"' -o tsv 2>/dev/null || echo n/a)"
echo "bicep:  $(az bicep version 2>/dev/null || echo n/a)"
echo "gh:     $(gh --version | head -n1)"
echo "psql:   $(psql --version)"
echo "claude: $(claude --version 2>/dev/null || echo n/a)"

echo "==> postCreate complete."
