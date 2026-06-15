# Dev container

Reproducible dev environment for the Allarounder monorepo.

## What's inside

| Component | Choice |
|-----------|--------|
| Topology | docker-compose: `app` (dev) + `db` (PostgreSQL 16) |
| Backend runtime | Python 3.12 + [uv](https://docs.astral.sh/uv/) |
| Frontend runtime | Node 20 LTS + pnpm (via corepack) |
| Integration tests | Docker-in-Docker → [testcontainers](https://testcontainers.com/) (ephemeral Postgres) |
| Cloud/infra | Azure CLI + Bicep, GitHub CLI, `psql` |
| E2E | Playwright (system deps installed in `postCreate.sh`) |
| Editor | VS Code: Ruff, Pylance, ESLint, Prettier, Bicep, Docker, Actions, PostgreSQL, Claude Code |
| AI tooling | Claude Code CLI (`claude`) via the Anthropic devcontainer feature |

## Usage

Open the folder in VS Code and **Reopen in Container** (or `devcontainer up`).

- The long-lived `db` service is reachable from `app` at host `db:5432`
  (`DATABASE_URL` is preset). It is **not** what integration tests use —
  those launch their own throwaway Postgres via testcontainers.
- `postCreate.sh` is idempotent and guards on `src/backend` / `src/frontend`
  existing, so it works now (empty repo) and after the apps are scaffolded.
- The `claude` CLI is installed but not authenticated. On first use run
  `claude` and follow the login prompt, or set `ANTHROPIC_API_KEY` in your
  environment (do **not** commit it).

## Files

- `devcontainer.json` — features, extensions, settings, lifecycle hooks.
- `docker-compose.yml` — `app` + `db` services, volumes, network.
- `Dockerfile` — `app` image (Python base + uv + psql).
- `postCreate.sh` — pnpm/Playwright bootstrap + per-app dependency install.
