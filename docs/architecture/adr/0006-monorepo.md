# ADR-0006: Repository layout: monorepo

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The system has two deployables — the FastAPI API (ADR-0001) and the Next.js frontend (ADR-0002) — built and deployed via GitHub Actions to Azure Container Apps (ADR-0004). With one developer, we want a layout that keeps the two apps coordinated without unnecessary process overhead.

## Decision

Use a single **monorepo** on GitHub. All source lives under a top-level `src/` folder: **`src/backend/`** (FastAPI) and **`src/frontend/`** (Next.js). GitHub Actions workflows are **path-filtered** so each app builds and deploys only when its folder changes. Each app is its own Docker image and Azure Container App.

```
allarounder/
├── src/
│   ├── backend/      # FastAPI
│   └── frontend/     # Next.js
├── infra/            # IaC / Azure resources (optional)
├── docs/             # PRD, tech spec, ADRs
├── .github/workflows/   # deploy-backend.yml, deploy-frontend.yml (path-filtered)
└── README.md
```

## Options Considered

### Option A: Monorepo (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low for a solo developer |
| Cost | None |
| Scalability | Good with path filters |
| Team familiarity | Good |

**Pros:** One place for issues/PRs/config; API and frontend stay in sync; atomic cross-cutting changes; shared docs and tooling.
**Cons:** Workflows need path filtering to avoid rebuilding everything; can grow large over time.

### Option B: Two separate repositories
**Pros:** Clean separation, independent histories and access control.
**Cons:** More overhead coordinating changes that span both apps; harder to keep contract changes atomic; duplicated config — unnecessary for a one-developer team.

## Trade-off Analysis

For a single developer building two tightly-coupled apps (frontend depends on the API contract), the monorepo minimizes coordination cost and keeps changes atomic. Path-filtered workflows recover most of the independent-deploy benefit of separate repos. Polyrepo's isolation benefits don't justify the overhead at this team size.

## Consequences

- **Easier:** Coordinated changes, shared docs/config, single PR for contract changes, one CI configuration location.
- **Harder:** CI must use path filters; repo grows with both stacks; future multi-team scaling may eventually favor splitting.
- **Revisit if:** The team grows and independent ownership/access boundaries become important.

## Action Items
1. [ ] Create the GitHub monorepo with the `src/backend` + `src/frontend` layout.
2. [ ] Add path-filtered `deploy-backend.yml` and `deploy-frontend.yml`.
3. [ ] Move `docs/` (PRD, tech spec, ADRs) into the repo.
