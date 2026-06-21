# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the **planning and specification workspace** for **Allarounder**, an Italian written-articles blog that promotes a podcast hosted on Spotify. **No application code exists yet** — the repo currently holds decisions, ADRs, a tech spec, the site/data-model design, and a content-team questionnaire. The build has not started.

When building begins, code is intended to live in a `src/` monorepo (`src/backend/` FastAPI, `src/frontend/` Next.js) with `infra/` for Bicep IaC — none of these directories exist yet.

## The product in one paragraph

The site publishes **written articles in Italian only**; each article links out to the matching **Spotify episode**. The site hosts **no audio** — no player, streaming, or RSS feed. Its purpose is to rank in Italian search (SEO is product-critical) and drive readers to Spotify. The canonical domain is `allarounder.it`; `allarounder.eu` 301-redirects to it.

## Two-language rule (important)

- **Site content** (article bodies, UI copy, public URL slugs like `/articoli/`, `/argomenti/`) is **Italian**.
- **Code** — identifiers, comments, technical docs, commit messages, branch names — is **English**.

Keep these separate. Italian belongs in content and content-facing routes; everything an engineer reads is English.

## Documentation map (the repo is its own source of truth)

Before proposing architecture or implementation, read the relevant file rather than inferring. Note all docs live under `docs/`:

- **`docs/README.md`** — documentation index and a one-screen decision summary. Good entry point.
- **`docs/DECISIONS.md`** — the running decision log: every settled choice with rationale, trade-offs, and status (✅ final / 🔄 provisional / ❓ open / 📦 superseded). **Read this first** for *what* and *why*.
- **`docs/architecture/adr/`** — Architecture Decision Records (0001–0010), one decision per file, with full rationale, options considered, and consequences. `DECISIONS.md` summarizes; the ADRs are the deep source. See `adr/README.md` for the index.
- **`docs/architecture/TECH-SPEC.md`** — how the system is built and operated: architecture diagram, backend layering, data-model summary, API surfaces, Azure infra table, CI/CD, testing strategy.
- **`docs/architecture/SITE-STRUCTURE.md`** — sitemap/URL structure, full field-level data models, complete API endpoint list, article page layout, SEO fields.
- **`docs/product/PRD.md`** — the Product Requirements Document (Draft v1, 2026-06-17): vision, goals, audience, v1 scope, user stories, data model, API surface, build sequence, and testing decisions. The authoritative *what* and *why*.
- **`docs/product/content-team-questionnaire.md`** — the content-team answers that informed the PRD.
- **`podcast-blog-website.plugin`** (project root, outside `docs/`) — a zip bundle of Claude Code skills used during planning (decision-tracker, site-structure-designer, content-guidelines, tech-stack-advisor); not application code.

When a decision changes, **add a new ADR that supersedes the old one** and update `docs/DECISIONS.md` — do not rewrite decision history.

## Settled architecture (do not re-litigate without a new ADR)

- **Backend:** Python + **FastAPI** as a headless JSON API (Uvicorn/Gunicorn). SQLAlchemy + Alembic. Pydantic schemas. Two API surfaces: a **public read API** (published content only) and an **authenticated admin API** (OAuth2 password flow + JWT, roles `admin`/`editor`).
- **Backend structure — pragmatic DDD (ADR-0008):** a single core **Content/Publishing** bounded context, layered `domain` / `application` / `infrastructure` / `interfaces` with a **strict inward dependency rule — the `domain/` layer imports no framework code** (no FastAPI, no SQLAlchemy, no logging library). `Article` is the aggregate root; `Slug`, `SpotifyUrl`, `Seo`, `PublicationStatus`, `Body` (Markdown) are value objects; repository interfaces live in `domain/`, SQLAlchemy implementations in `infrastructure/`. `identity` and `newsletter` are supporting contexts that start minimal.
- **Frontend:** a **separate Next.js app** rendering the public site with **SSR/ISR** (required for SEO), consuming the public read API. Also hosts the custom admin UI.
- **Content management:** a **custom-built admin UI** for 3 non-technical writers — *not* a CMS. Flagged as the largest single chunk of build work and the main timeline risk; build the article editor (create/edit/publish, cover image, Spotify link) first, and the taxonomy/guest/author screens as simple CRUD.
- **Article body:** **Markdown** stored as plain text, rendered to HTML by Next.js, modeled as a `Body` value object. Images are Blob Storage URL references, never embedded HTML (avoids stored-HTML/XSS).
- **Author vs User (ADR / DECISIONS):** `Author` (public byline: name, bio, photo, links) and `User` (login account: email, hashed password, role) are **separate entities** with an **optional 1:1 link** (`Author.user_id`, nullable) — an Author can exist without a User (guest bylines).
- **Scheduling:** **read-time filter only** — the public API returns `status = published AND publish_at <= now`. No cron/worker/scheduler in v1; scheduled posts appear within the cache-revalidation window.
- **Data:** Azure Database for **PostgreSQL** (Flexible Server) for all structured content; **Azure Blob Storage** for images only. **No Episode/audio model** — the Spotify link is a URL field on `Article`.
- **Infra:** **Azure**, region **Italy North**. Compute on **Azure Container Apps** (one app each for backend and frontend), images in **Azure Container Registry**, edge via **Azure Front Door** (TLS, WAF, `.eu → .it` 301), secrets in **Azure Key Vault**, monitoring via **Azure Monitor / Application Insights**. IaC is **Bicep** in `infra/`.
- **Observability (ADR-0010):** instrument both apps with **OpenTelemetry** → Azure Monitor / Application Insights (Log Analytics in Italy North). **Structured JSON logs** to stdout (`structlog` backend, `pino` frontend); propagate **W3C `traceparent`** across the frontend→backend hop so a request is traceable end-to-end. INFO+ in prod / DEBUG in dev. **Redact PII & secrets** at the logging boundary (GDPR). Logging stays out of the `domain` layer; tests assert no secrets/PII are logged.
- **Repo/CI:** single **monorepo** on GitHub; **GitHub Actions** with two **path-filtered** workflows (`src/backend/**`, `src/frontend/**`): lint/test → build image → push to ACR → deploy. **Separate `staging` and `production`** environments, both stamped from the same Bicep with different parameters; verify on staging, then promote. CI authenticates to Azure via **OIDC federated credentials** (no long-lived secrets).
- **Secrets** are never committed. Key Vault is provisioned via Bicep, but secret *values* are injected through a secure step.

## Development methodology: Test-Driven Development (ADR-0009)

The project mandates **TDD (red → green → refactor)** — tests are written before implementation and live alongside the code. The framework-free `domain/` layer is what makes domain unit tests fast and TDD practical. Test pyramid:

| Layer | Scope | Tools |
|-------|-------|-------|
| Domain unit | `Article` aggregate, value objects, domain services — no I/O | pytest |
| Application | Use cases against fake/in-memory repositories | pytest |
| Integration | Repository impls + migrations against **real PostgreSQL** | pytest + **testcontainers** (needs Docker) |
| API / contract | Endpoints, auth, OpenAPI conformance | httpx / schemathesis |
| Frontend unit | Components, hooks | Vitest + React Testing Library |
| E2E | Critical visitor + editor flows | Playwright |

Both CI workflows run their test suite with a **coverage gate before** building/pushing images.

## v1 scope vs phase 2

- **v1:** articles, categories, **tags**, **guests**, cover images, the Spotify link, the custom admin UI, SEO.
- **Phase 2 (deferred):** newsletter (signup/subscribers backend) and comments. An external embedded form is the interim option for email capture.
- **Out of scope entirely:** hosting/streaming audio, RSS feed, i18n/multilingual, public user accounts.

## Commands

No build, test, or run commands exist yet — there is no `src/`, `package.json`, `pyproject.toml`, or `Makefile`. Fill this section in once the backend (pytest, alembic, uvicorn) and frontend (Next.js, vitest, playwright) are scaffolded.

The working directory is on Windows; available shells are PowerShell (primary) and a Bash tool for POSIX scripts.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gweedo/allarounder`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default mattpocock/skills label vocabulary (no overrides). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at repo root + ADRs at `docs/architecture/adr/`. See `docs/agents/domain.md`.
