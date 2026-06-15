# ADR-0003: Content management: custom admin UI

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

Three non-technical writers will create and publish articles. The backend is FastAPI (ADR-0001), which provides no admin interface, and the frontend is a separate Next.js app (ADR-0002). We need a way for writers to author, edit, schedule, and publish articles, and to upload cover images.

## Decision

Build a **custom admin UI** backed by an authenticated FastAPI admin API. Writers log in (role `editor`), manage articles/media; Guido has `admin` role. Images upload to Azure Blob Storage.

## Options Considered

### Option A: Custom admin UI (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | High — build editor, auth, media, scheduling |
| Cost | Developer time (largest single chunk of work) |
| Scalability | High — fully under our control |
| Team familiarity | N/A — bespoke |

**Pros:** Full control of the editorial workflow and data model; no third-party dependency or cost; tailored to the writers.
**Cons:** Largest build effort in the project; re-implements what a CMS provides for free; ongoing maintenance.

### Option B: Headless CMS (Sanity / Strapi / Contentful)
**Pros:** Friendly editor for non-technical writers out of the box; fast to stand up; feeds the FastAPI app or frontend via API.
**Cons:** Another service/dependency (and possibly cost); less control; another system to learn and integrate.

### Option C: Django admin / Wagtail
**Pros:** Free, mature editorial UI.
**Cons:** Requires Django — contradicts the FastAPI decision (ADR-0001).

### Option D: Markdown files in Git
**Pros:** Dev-friendly, versioned, no UI to build.
**Cons:** Not usable by non-technical writers — disqualifying given the team.

## Trade-off Analysis

The custom admin UI gives maximum control at maximum cost, and it is the project's biggest build-effort and timeline risk. A headless CMS is the lower-effort alternative that still serves non-technical writers and would not disturb the FastAPI API choice. The team chose to build custom for control; we mitigate the risk by keeping v1 minimal (create/edit/publish, cover image, Spotify link) and deferring nice-to-haves.

### Re-evaluation (2026-06-14)
The full authoring landscape was reviewed before committing: custom admin (A1), git-based CMS embedded in the site such as Decap/TinaCMS/Keystatic (A2), self-hosted headless CMS such as Payload/Directus/Strapi (B1), SaaS headless CMS such as Sanity/Contentful (B1), Notion-as-CMS (B2), and a Google Docs pipeline (B3). Options A2/B1-SaaS/B2 were noted to move the content source-of-truth out of the FastAPI/Postgres core. The team re-affirmed the **custom admin (A1)** to keep content in the EU Postgres and retain full control, accepting the higher build effort. The self-hosted headless CMS (B1) remains the designated fallback if the build effort threatens the timeline.

## Consequences

- **Easier:** Editorial workflow and data exactly as we want; no external CMS dependency or cost.
- **Harder:** Significant build and maintenance; rich-text/Markdown editing, media handling, auth, roles, and scheduling are all on us.
- **Revisit if:** The admin UI jeopardizes the MVP timeline — swap in a headless CMS without changing the public API.

## Action Items
1. [ ] Define admin API endpoints (CRUD articles/categories/guests/authors/pages, media upload, publish).
2. [ ] Implement OAuth2/JWT auth with `editor`/`admin` roles.
3. [ ] Build minimal v1 editor (Markdown recommended — see TECH-SPEC) with cover-image upload and Spotify link.
4. [ ] Keep tags/guests/newsletter/comments out of v1 unless confirmed.
