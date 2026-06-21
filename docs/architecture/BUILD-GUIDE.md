# Allarounder — Build Guide (stage by stage)

**Status:** Draft
**Date:** 2026-06-17
**Audience:** the developer (Guido)
**Related:** `../product/PRD.md` (§12 build sequence), `TECH-SPEC.md`, `SITE-STRUCTURE.md`, `adr/`

A deep, practical walkthrough of the nine build stages from PRD §12. For each stage: **goal**, **what to build**, **key design points / gotchas**, **tests (TDD)**, and **done when**. Build in this order — each stage stands on the previous, and the domain is built before anything touches a database.

## How to work each stage (TDD rhythm)

Red → green → refactor. The primary backend seam is the **API layer** (httpx + testcontainers against real Postgres); below it sit fast **domain** and **application** unit tests; above it, two **Playwright** golden paths. For every feature: write the failing test at the lowest layer that expresses the behaviour, make it pass, refactor. Keep `domain/` free of frameworks (no FastAPI, no SQLAlchemy, no logging) — that constraint is what keeps the domain tests instant.

Infra/CI/observability are scaffolded in Stage 1 and progressively filled — you don't need a live Azure deploy to build Stages 2–7; Docker Compose + testcontainers cover local work.

---

## Stage 1 — Monorepo scaffold

**Goal.** A repo that boots locally with `docker compose up` and runs green CI on a trivial test. No features yet — just the skeleton everything plugs into.

**What to build.**
- Repo layout: `src/backend/`, `src/frontend/`, `infra/` (Bicep), `docs/`, root `docker-compose.yml`, `.github/workflows/`, `README.md`.
- **Backend skeleton:** Python project (`pyproject.toml`), FastAPI app with a `/health` endpoint, Uvicorn entrypoint. Tooling: Ruff + Black + mypy + pytest configured. DDD package tree under `src/backend/`: `content/{domain,application,infrastructure,interfaces}/`, plus `identity/` and `shared/`. `alembic init`. Multi-stage `Dockerfile`.
- **Frontend skeleton:** Next.js (TypeScript) app with a placeholder homepage. Tooling: ESLint + Prettier, Vitest, Playwright. Multi-stage `Dockerfile`.
- **docker-compose.yml:** services `db` (Postgres), `backend`, `frontend`, wired with env vars; a named volume for Postgres.
- **CI skeleton:** two path-filtered workflows (`src/backend/**`, `src/frontend/**`) running lint + type-check + a trivial test, with the coverage-gate config in place (threshold can start at 80% with one passing test).
- **Bicep outline:** stub modules for resource group, ACR, Container Apps environment, PostgreSQL Flexible Server, Storage, Key Vault, Front Door — not yet deployed; just structure + parameters for `staging`/`production`.

**Key design points / gotchas.**
- Pin the DDD folder boundaries now; it's painful to retrofit. Add a lint rule or a simple import-linter contract that forbids `domain/` from importing framework packages.
- Decide the dependency manager (uv/poetry/pip-tools) and Node package manager once, and commit lockfiles.
- Keep secrets out of compose — use a `.env` (gitignored) with local-only values.

**Tests.** One backend unit test (e.g. a trivial value object or `/health`) and one frontend unit test, both green in CI. This proves the pipeline before real code exists.

**Done when.** `docker compose up` serves the FastAPI `/health` and the Next.js placeholder; CI is green; the import boundary is enforced.

---

## Stage 2 — Article domain model (the heart, pure TDD)

**Goal.** The framework-free core of the system, fully unit-tested with no I/O. This is where the rules that the rest of the app depends on are proven.

**What to build (in `content/domain/`).**
- **Value objects:**
  - `Slug` — generated from the Italian title (lowercase, strip accents, hyphenate, trim); validates charset/length. Uniqueness is enforced at the repository, not here.
  - `Body` — Markdown text; non-empty, max length; this is the `Body` value object from the decisions.
  - `SpotifyUrl` — **optional**; when present, validates it is a Spotify show/episode URL; rejects malformed input.
  - `PublicationStatus` — enum `draft` / `published` / `archived` (no `scheduled`).
  - `Seo` — meta title (≤60) and description (140–155) with fallback logic (title → `{title} — Allarounder`, description → excerpt).
- **Aggregate root `Article`** with behaviour, not just data:
  - `create(...)` → new draft, slug auto-generated, `preview_token` minted.
  - `change_slug(new)` → allowed only while `draft`; raises `SlugLockedError` otherwise.
  - `publish(at)` → sets status `published`, sets `publish_at`, **locks the slug**, **invalidates `preview_token`**; invalid from `archived` unless rules allow.
  - `archive()` → hides without delete.
  - `is_publicly_visible(now)` → `status == published and publish_at <= now` (the read-time scheduling rule).
- **Domain errors:** `SlugLockedError`, `InvalidStatusTransition`, `InvalidSpotifyUrl`, `EmptyBody`, etc.
- **Repository interface (port):** `ArticleRepository` (`add`, `get_by_id`, `get_by_slug`, `list_published`, `exists_slug`, …) — interface only, lives in `domain/`.

**Key design points / gotchas.**
- Slug **immutability after publish** is a domain invariant, not a DB constraint — test it explicitly.
- "Scheduling" is *not* a status; don't add one. A future `publish_at` on a `published` article is simply not yet visible.
- Keep `SpotifyUrl` optional end-to-end; a `None` is a valid standalone article.
- The aggregate owns the `preview_token` lifecycle (minted on create, invalidated on publish).

**Tests (pytest, no I/O).** Slug generation + lock-after-publish; status transitions (valid/invalid); `is_publicly_visible` across draft/published/future-`publish_at`/archived; `SpotifyUrl` valid/invalid/empty; `Body` validation; preview-token invalidation on publish; `Seo` fallbacks.

**Done when.** The domain test suite is comprehensive and green, and `domain/` imports zero framework code.

---

## Stage 3 — Article admin API (CRUD + publish + auth)

**Goal.** Persist and operate articles through an authenticated API, verified by integration tests against real Postgres.

**What to build.**
- **Application layer (`content/application/`):** use cases `CreateArticle`, `UpdateArticle`, `PublishArticle`, `ArchiveArticle`, `CreatePreviewToken`; command/result DTOs. They depend on the `ArticleRepository` *interface*, not the implementation.
- **Infrastructure (`content/infrastructure/`):** SQLAlchemy ORM models + **mappers** translating domain objects ↔ rows (so the domain stays clean); `SqlAlchemyArticleRepository`; the first **Alembic migration** (articles, categories, tags, guests, authors, users, join tables); a **Blob storage adapter** that mints SAS tokens; Key Vault config loading.
- **Identity (`identity/`):** `User` (email, hashed password, role), user repository, password hashing (bcrypt/argon2), JWT issue/verify, and a **CLI** `python -m cli create-admin` to seed the first admin (no registration endpoint).
- **Interfaces (`content/interfaces/`):** FastAPI routers — `POST /api/admin/auth/login` (→ JWT), `/api/admin/articles` CRUD, `POST /api/admin/articles/{id}/publish`, `POST /api/admin/media/sas`. Pydantic request/response schemas. A **role-enforcement dependency**: `editor` may manage only their own articles and may not touch users/authors/categories/tags; `admin` may do anything.

**Key design points / gotchas.**
- The router is thin: translate HTTP ↔ application call; no business logic.
- **SAS upload:** `/media/sas` returns `{ sas_url, blob_url }`; the browser PUTs the bytes directly to Blob; the backend stores only `blob_url`. The backend never streams image bytes.
- Publishing is a domain transition invoked by the use case — the API just calls it and maps `SlugLockedError`/`InvalidStatusTransition` to 409/422.
- Enforce the published-only filter (`status=published AND publish_at<=now`) on the public read side (Stage 5), not the admin side.

**Tests.** Application unit tests with **fake in-memory repositories** (use-case orchestration). API integration tests (httpx + testcontainers): create draft → publish → slug now locked (error on change); editor scoping (editor can't manage taxonomy / others' articles); pagination shape `{items,total,page,page_size}`; `/media/sas` response shape; auth required; login issues a working JWT. Assert **no PII/secrets in logs** via log capture.

**Done when.** An authenticated admin/editor can create, edit, publish, and archive articles via the API; integration tests green; migrations apply cleanly on a fresh DB.

---

## Stage 4 — Article admin UI (the editor)

**Goal.** The custom authoring experience for non-technical writers — the largest single frontend chunk and the main timeline risk (ADR-0003). Build the article editor first.

**What to build (Next.js, under `/admin`).**
- **Auth:** login page calling `/api/admin/auth/login`; store the JWT and attach it to admin API calls; route guard redirecting unauthenticated users.
- **Article list:** the editor's articles with status badges; "new article" entry.
- **Article editor form:**
  - **Markdown editor** with a toolbar (bold, italic, headings, links, images) and a **live preview pane**, so writers never need raw syntax.
  - **Slug** auto-generated from the title as they type; editable while draft; shown locked once published.
  - **Cover image upload** via the SAS flow (request SAS → PUT to Blob → save `blob_url`); same for author/guest photos later.
  - **Spotify URL** field — optional, validated client-side and server-side; leaving it empty is valid.
  - **Category** single-select (the four seeded), **Tags** multi-select (create inline), **Guests** multi-select.
  - **SEO** fields (meta title/description, og:image) with fallback placeholders shown.
  - **Preview** button opening `/preview/articles/{preview_token}` in a new tab.
  - **Publish / schedule (set `publish_at`) / archive** actions.

**Key design points / gotchas.**
- Reflect domain rules in the UI: disable slug editing after publish; show the Spotify block toggling on/off in preview when the URL is set/cleared.
- Handle SAS upload failures gracefully (token expiry, network) — the upload is direct-to-Blob, so surface its errors.
- Keep the editor a controlled component so the live preview and toolbar insertions stay in sync.

**Tests.** Vitest + React Testing Library against a **mocked API**: slug auto-generation, toolbar inserts Markdown, preview link points at the token URL, required-field validation, Spotify URL validation, optional-empty allowed.

**Done when.** An editor can log in and take an article from blank → draft → preview → published entirely through the UI on a local stack.

---

## Stage 5 — Public article pages (SSR/ISR + SEO)

**Goal.** The public Italian site core — fast, indexable, shareable.

**What to build (Next.js public).**
- **Homepage:** latest article as a hero + a paginated grid of recent articles below.
- **Article page `/articoli/{slug}`** in the decided layout: H1 → date · author · category → **Spotify CTA block (only when `spotify_url` present)** → body (Markdown → sanitized HTML) → **3 related articles** from the same category. Mobile-responsive and legible.
- **Listings:** `/argomenti` + `/argomenti/{slug}` (category), `/tag/{slug}` (tag).
- **Rendering:** ISR with **on-publish revalidation** (revalidate the affected paths/tags when an article is published) or SSR; pages consume the public read API (published-only).
- **SEO per page:** `<title>`, meta description, `<link rel="canonical">` → always `.it`, `og:title/description/image` (image falls back to cover), JSON-LD `Article`.

**Key design points / gotchas.**
- Sanitize rendered Markdown (allowlist) — even though bodies are Markdown, render through a safe pipeline.
- The Spotify block, related-episode recap, and closing CTA all render **only when** the article has a link; standalone articles must look clean without them.
- Revalidation window: scheduled articles appear within the ISR window, not to the second — that's expected (read-time scheduling).

**Tests.** Component unit tests (article layout with/without Spotify). **E2E golden path #1** (Playwright): editor logs in → creates draft → previews → publishes → reader visits the public page → Spotify CTA present → JSON-LD + OG correct. **E2E #2:** publish with no Spotify URL → public page renders without the Spotify block.

**Done when.** Published articles are publicly visible, server-rendered, indexable, and share with a rich card.

---

## Stage 6 — Author & guest management

**Goal.** Bylines and episode participants, with public profile pages.

**What to build.**
- **Admin CRUD** for `Author` (name, bio, photo via SAS, links; **optional 1:1 link to a `User`** so a writer's login auto-associates with their byline — ADR-0011) and for `Guest` (name, bio, photo, links). Admin-only.
- **Public profile pages:** `/autori/{slug}` listing the author's articles; `/ospiti/{slug}` listing articles a guest appeared in. JSON-LD `Person` where relevant.

**Key design points / gotchas.**
- `Author` and `User` are separate; an author can exist with no user (guest byline). Linking is optional and admin-controlled.
- Guests are many-to-many with articles (`article_guests`); an author is the single byline (`author_id`).

**Tests.** API integration: CRUD + role enforcement (editors can't manage authors/guests), author↔user linking. Public-page rendering with the author's/guest's article list.

**Done when.** Admins manage authors/guests; public profile pages list the right articles.

---

## Stage 7 — Static pages

**Goal.** Non-article content the team can edit.

**What to build.**
- `Page` model (title, slug, Markdown body, SEO) with **admin CRUD**; public rendering for **Chi siamo**, **Contatti**, **Privacy Policy**, **Cookie Policy**.
- Footer links wired to these pages.

**Key design points / gotchas.**
- Privacy + Cookie pages are needed for EU compliance and the consent banner; don't skip them.
- A working **Contatti** form (sending email) is not yet specified — for v1 keep Contatti informational, or note a contact-form as a small follow-up (it would add an email-send dependency).

**Tests.** Admin edit + public render; footer links resolve.

**Done when.** All four static pages are editable and live.

---

## Stage 8 — SEO hardening

**Goal.** Make the whole site maximally discoverable and shareable — product-critical, since reaching generalists via search is a core goal.

**What to build.**
- **`/sitemap.xml`** auto-generated from published articles + authors + guests + categories + tags.
- **`/robots.txt`** allowing the public site and **blocking `/admin`** (and `/preview/`).
- **JSON-LD** across content types (`Article`, `Person`); **canonical** to `.it` on every page; **OG cards** with cover fallback everywhere.
- Confirm the **`.eu → .it` 301** at Front Door and canonical alignment.
- Performance pass: ISR/Front Door caching, image delivery via Blob+Front Door, pagination on lists.

**Key design points / gotchas.**
- Keep the sitemap in sync with publication state (only published, current `publish_at`).
- Verify OG/JSON-LD with a validator; Instagram/WhatsApp/iMessage previews depend on correct OG tags.

**Tests.** Sitemap contains expected published URLs and excludes drafts; robots blocks `/admin`; E2E asserting meta/JSON-LD presence on an article.

**Done when.** Sitemap/robots correct, every page has canonical + OG + JSON-LD, redirect verified.

---

## Stage 9 — Events (post-September launch, before December)

**Goal.** A simple, informational events section — deliberately deferred so it doesn't risk the September target.

**What to build.**
- **`Event` domain + model** (per PRD §12): title, slug, `starts_at`, `ends_at?`, `location?`, Markdown body, `cover_image_url?`, `cost?` (display string), `max_capacity?`, `registration_url?`, `link_url?`, status (`draft`/`published`).
- **API:** public `GET /api/events`, `/api/events/{slug}`; admin CRUD.
- **Public pages:** `/eventi` listing + `/eventi/{slug}` detail.

**Key design points / gotchas.**
- v1 is **informational only** — `registration_url` points out to an external form; **no in-house ticketing/registration** (deferred).
- Event is standalone (no relationships to Article) — a small, self-contained addition.

**Tests.** API integration (CRUD, published filter) + public listing/detail rendering.

**Done when.** Events can be created in admin and appear at `/eventi`.

---

## Cross-cutting, wired progressively

- **Migrations** run as a dedicated **pre-traffic** job (expand/contract, roll-forward) — see ADR-0012. Each schema change ships additively.
- **CI/CD** (ADR-0012): the pipeline (lint → tiered tests → scans → SHA-tagged image → staging → manual approval → blue-green prod) is scaffolded in Stage 1 and becomes load-bearing once you first deploy (after Stage 5 is demo-able is a natural first staging deploy).
- **Observability** (ADR-0010): add OpenTelemetry + structured JSON logs (structlog/pino) with `traceparent` propagation and PII redaction as soon as the API exists (Stage 3); the `domain/` layer stays log-free.
- **Auth & secrets:** OIDC for CI→Azure; runtime secrets via Key Vault managed-identity references — stand these up when wiring the first real deploy.

## Suggested first three commits

1. Stage 1 scaffold (compose up + green CI).
2. Stage 2 `Slug` + `SpotifyUrl` value objects, test-first.
3. Stage 2 `Article` aggregate with publish/slug-lock rules, test-first.

From there, follow the sequence. The domain (Stage 2) is the highest-leverage place to be rigorous — everything else leans on those rules.
