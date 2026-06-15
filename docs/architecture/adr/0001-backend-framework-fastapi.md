# ADR-0001: Backend framework: FastAPI

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

Allarounder is a written-articles blog that promotes an Italian podcast hosted on Spotify; the site hosts no audio and links out to episodes. The language is fixed to **Python** and hosting to **Azure**. The team is one developer plus three non-technical writers.

We need a backend framework that ships an MVP quickly but remains robust and scalable as the product grows in size and complexity. The site is content-driven and SEO matters, since the site's job is to drive readers to Spotify.

## Decision

Build the backend with **FastAPI**, exposing a JSON API (headless). Persistence via SQLAlchemy + Alembic; PostgreSQL as the database (see ADR-0005).

## Options Considered

### Option A: FastAPI
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — no batteries; admin/ORM/CMS assembled |
| Cost | Low runtime cost; async-efficient |
| Scalability | High — async-first, API-friendly |
| Team familiarity | Good for the developer; API-first model |

**Pros:** Modern async, fast, automatic OpenAPI docs, clean fit for a decoupled API + separate frontend, scales well.
**Cons:** No built-in admin, ORM, or CMS — these must be built (notably the editorial UI, see ADR-0003); not designed to server-render content pages.

### Option B: Django (+ Wagtail)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low for content sites — batteries included |
| Cost | Low |
| Scalability | High (proven at scale) |
| Team familiarity | Good |

**Pros:** Built-in admin/ORM/auth, Wagtail gives non-technical writers a full CMS for free, server-rendered SEO-friendly pages out of the box. Fastest path to MVP for a blog.
**Cons:** More opinionated/heavier; less natural for a deliberately decoupled API + JS frontend architecture.

### Option C: Flask
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium-High — assemble everything |
| Cost | Low |
| Scalability | Medium-High |
| Team familiarity | Good |

**Pros:** Minimal, flexible.
**Cons:** Most plumbing to reach feature parity; no admin/ORM/CMS; less modern async story than FastAPI.

## Trade-off Analysis

Django + Wagtail was the recommended default and the fastest route to MVP because it hands the writers a CMS for free. The team chose FastAPI instead, prioritizing a modern, decoupled, API-first architecture that scales cleanly into a larger system. The accepted cost is building the editorial experience ourselves (ADR-0003) and pairing FastAPI with a separate frontend for rendering (ADR-0002). FastAPI's async model and OpenAPI tooling suit a long-lived API; the main risk is the extra build effort versus Django's batteries.

## Consequences

- **Easier:** A clean, documented JSON API; decoupled frontend; modern async backend; horizontal scaling.
- **Harder:** No free admin/CMS — a custom admin UI must be built (ADR-0003). Data layer (SQLAlchemy, Alembic, auth, validation) is assembled manually.
- **Revisit if:** Editorial build effort threatens the timeline — a headless CMS could replace the custom admin without changing the API choice.

## Action Items
1. [ ] Scaffold FastAPI app under `src/backend/` with SQLAlchemy + Alembic.
2. [ ] Define models per `SITE-STRUCTURE.md`.
3. [ ] Set up OAuth2/JWT auth for the admin API.
