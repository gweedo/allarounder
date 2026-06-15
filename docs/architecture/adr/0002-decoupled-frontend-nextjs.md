# ADR-0002: Decoupled frontend: Next.js

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The backend is FastAPI serving a JSON API (ADR-0001), which does not render HTML pages. The public site is a content blog where **SEO is critical** — its purpose is to rank in Italian search and drive readers to Spotify. We therefore need a rendering layer that is indexable and fast.

## Decision

Build the public site as a **separate Next.js application** that consumes the FastAPI API. Use **server-side rendering / static generation (ISR)** so article pages are fully indexable. Frontend lives under `src/frontend/`.

## Options Considered

### Option A: Separate Next.js frontend (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium-High — second app, second deployable |
| Cost | One more container/Container App |
| Scalability | High — frontend and API scale independently |
| Team familiarity | Good (developer) |

**Pros:** First-class SSR/SSG/ISR for SEO, clean separation from the API, rich ecosystem, independent scaling and deploys.
**Cons:** A second codebase/deployable to build and operate; must keep API contract in sync.

### Option B: FastAPI + Jinja2 server-rendered templates
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — single app |
| Cost | One deployable |
| Scalability | Medium |
| Team familiarity | Good |

**Pros:** Simplest for an MVP, SEO works natively, one thing to deploy.
**Cons:** Couples rendering to the API; less flexible frontend; not the decoupled architecture the team wants.

### Option C: Next.js SPA (client-rendered, no SSR)
**Pros:** Simple frontend hosting.
**Cons:** Poor SEO without SSR/prerendering — disqualifying for a content blog.

## Trade-off Analysis

Jinja2 templates would have been the least-effort MVP, but the team chose a decoupled architecture for flexibility and scale, accepting a second deployable. Within the decoupled choice, SSR/ISR is mandatory: a pure client-rendered SPA would undermine the SEO the whole project depends on. Next.js provides SSR/ISR as a first-class capability.

## Consequences

- **Easier:** Independent scaling/deploys of site vs API; flexible, modern frontend; strong SEO via SSR/ISR.
- **Harder:** Two apps to build, deploy, and version together; the API contract must stay stable; more moving parts in CI/CD.
- **Revisit if:** Operational overhead outweighs benefits for the MVP — could collapse to Jinja2 server-rendering on FastAPI.

## Action Items
1. [ ] Scaffold Next.js app under `src/frontend/`.
2. [ ] Implement article pages with ISR + on-publish revalidation.
3. [ ] Add `sitemap.xml`, `robots.txt`, JSON-LD `Article` schema, canonical tags to `.it`.
