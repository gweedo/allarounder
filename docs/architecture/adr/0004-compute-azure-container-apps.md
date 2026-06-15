# ADR-0004: Compute: Azure Container Apps

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

Hosting is fixed to **Azure**. We have two deployables — the FastAPI API (ADR-0001) and the Next.js frontend (ADR-0002) — and want a platform that supports containers, scales as the product grows, and integrates with GitHub Actions CI/CD.

## Decision

Run both apps on **Azure Container Apps**, each as its own containerized app. Images are built in GitHub Actions, pushed to **Azure Container Registry (ACR)**, and deployed to Container Apps. Target an EU region (**Italy North**).

## Options Considered

### Option A: Azure Container Apps (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — containers + registry + config |
| Cost | Pay-for-use; scale-to-zero possible |
| Scalability | High — KEDA-based autoscaling |
| Team familiarity | Good (developer comfortable with Docker) |

**Pros:** Container-native portability, independent scaling per app, fits a multi-service architecture, autoscaling, clean GitHub Actions integration.
**Cons:** More setup than App Service (Dockerfiles, registry, revisions/ingress config).

### Option B: Azure App Service
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — native Python runtime, push-to-deploy |
| Cost | Predictable plans |
| Scalability | Medium-High (scale-out) |
| Team familiarity | Good |

**Pros:** Simplest path, managed SSL, staging slots, least ops for an MVP.
**Cons:** Less container-portable; less natural for a multi-container, microservices-leaning future.

### Option C: Static Web Apps + Functions
**Pros:** Great for a static frontend + serverless API.
**Cons:** Fits a serverless/headless function model, not a long-running FastAPI service; awkward for this architecture.

## Trade-off Analysis

App Service is the lower-effort MVP host and was the recommended default. The team chose Container Apps to standardize on containers and keep a clean path to a larger, more complex multi-service system, accepting more initial setup. Because both apps are containerized, moving between Azure container hosts later is low-friction.

## Consequences

- **Easier:** Portability, per-service scaling, a future-proof container platform, CI/CD via ACR + GitHub Actions.
- **Harder:** More upfront infra (Dockerfiles, ACR, ingress, env/secrets wiring) than App Service.
- **Revisit if:** Setup overhead outweighs benefits for the MVP — App Service remains a viable fallback.

## Action Items
1. [ ] Write Dockerfiles for `src/backend/` and `src/frontend/`.
2. [ ] Provision ACR, two Container Apps, and the Container Apps environment in Italy North.
3. [ ] Wire secrets via Key Vault / Container Apps secrets.
