# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the build repo for **Allarounder**, an Italian written-articles blog that promotes a gymnastics podcast hosted on Spotify. As of **2026-08-26** (ADR-0018) it builds a **static site**: writers author in Google Docs, a CI pipeline turns that into Markdown, and Next.js exports a static site deployed to Cloudflare Pages. There is no backend server, no database, no admin UI, and no authentication anywhere in this stack.

The repo holds two things: the static frontend (`src/frontend/`) and the content pipeline (`src/pipeline/`, in progress — see `NEXT-STEPS-PROMPT.md` for the remaining build tasks). `infra/` (Bicep), `src/backend/` (FastAPI), and Docker Compose are gone; a frozen copy of that pre-pivot application lives at `gweedo/allarounder-legacy` (archived, read-only).

## The product in one paragraph

The site publishes **written articles in Italian only**; each article optionally links out to the matching **Spotify episode**. The site hosts **no audio** — no player, streaming, or RSS feed. Its purpose is to rank in Italian search (SEO is product-critical) and drive readers to Spotify. The canonical domain is `allarounder.it`; `allarounder.eu` 301-redirects to it.

## Two-language rule (important)

- **Site content** (article bodies, UI copy, public URL slugs like `/articoli/`, `/argomenti/`) is **Italian**.
- **Code** — identifiers, comments, technical docs, commit messages, branch names — is **English**.

Keep these separate. Italian belongs in content and content-facing routes; everything an engineer reads is English.

## Documentation map (the repo is its own source of truth)

Before proposing architecture or implementation, read the relevant file rather than inferring. All docs live under `docs/`:

- **`docs/DECISIONS.md`** — the running decision log: every settled choice with rationale, trade-offs, and status (✅ final / 🔄 amended / 🔄 provisional / ❓ open / 📦 superseded). **Read this first** for *what* and *why*. The 2026-08-26 "Architecture pivot" entry and its neighbors are the current state; earlier entries about FastAPI/Postgres/Azure/the custom admin UI are marked superseded or amended, not deleted.
- **`docs/architecture/adr/`** — Architecture Decision Records, one decision per file. **ADR-0018 is the pivot** — read it for the full rationale and what it supersedes. See `adr/README.md` for the index and current status of every ADR.
- **`docs/architecture/TECH-SPEC.md`** and **`docs/architecture/SITE-STRUCTURE.md`** — describe the **retired** FastAPI/Postgres/Azure architecture and its API surface. Useful for the data-model shape (categories, tags, guests, SEO fields) that `content/index.json` still mirrors, but the API endpoints, backend layering, and infra sections no longer apply. Not yet rewritten for the pivot.
- **`docs/product/PRD.md`** — the original Product Requirements Document (Draft v1, 2026-06-17). Vision, audience, and v1 content scope (articles, categories, tags, guests, SEO) still apply; its build sequence and API surface sections describe the retired architecture.
- **`docs/product/content-team-questionnaire.md`** — the content-team answers that informed the PRD, including why the writers need a Google-Docs-native workflow.

When a decision changes, **add a new ADR that supersedes the old one** and update `docs/DECISIONS.md` — do not rewrite decision history.

## Settled architecture (do not re-litigate without a new ADR)

- **Editorial workflow:** writers author articles in **Google Docs**, indexed by a **Google Sheet** (one row per article: title, Doc link, category, tags, author, guest, Spotify link, cover image, meta description, publish date, status). Publishing is triggered by a **"Pubblica" button** in the Sheet (Apps Script → GitHub `repository_dispatch`), not automatically on save.
- **Content pipeline (`src/pipeline/`, Python, in progress):** a GitHub Actions job reads the Sheet, exports each Doc, converts HTML → Markdown, validates it against the domain value objects, and writes `content/articles/*.md` + `content/index.json` into `src/frontend/`. Generated content is **committed** — it is the audit trail and the rollback mechanism (`git revert`). See `NEXT-STEPS-PROMPT.md` Task 3 for what's built vs outstanding.
- **Domain layer (`src/pipeline/domain/`):** framework-free Python, moved from the retired backend. `Article` is the aggregate root; `Slug` (with `from_title`), `Body`, `SpotifyUrl`, `PublicationStatus` are value objects; entities are `Article`, `Author`, `Guest`, `Category`, `Tag`, `StaticPage`. This is the pipeline's build-time content validator — a bad Doc fails the build with an Italian-language error rather than publishing a broken page.
- **Frontend (`src/frontend/`):** Next.js with **`output: "export"`** — a pure static site, no server. `lib/content.ts` is the filesystem loader (reads `content/index.json` and `content/articles|pages/*.md` via `gray-matter` frontmatter) that replaced every page's old `fetch()` call to the retired backend; its exported types are the content contract the pipeline must emit. `images: { unoptimized: true }` — there is no Image Optimization API under static export. Security headers live in `public/_headers` (Cloudflare Pages convention), not `next.config.ts` (`headers()` does not run under export).
- **Hosting:** **Cloudflare Pages** (free tier), custom domain `allarounder.it`, with `allarounder.eu` 301-redirecting to it (ADR-0007). No server, no always-on compute.
- **Article body:** **Markdown**, rendered to sanitized HTML by `lib/markdown.ts` (`remark` → `remark-rehype` → `rehype-sanitize` → `rehype-stringify`). Images referenced by URL, never embedded HTML.
- **Author vs Guest:** `Author` (site byline) and `Guest` (interviewee/podcast guest) are separate entities, each with their own page (`/autori/[slug]`, `/ospiti/[slug]`).
- **Scheduling:** the pipeline publishes only rows where `stato = Pubblicato` **and** `data <= now`, checked at build time (a nightly cron re-run picks up future-dated posts — there is no server to run a read-time filter against).
- **No database, no server, no authentication.** Filtering (by category/tag/author/guest) happens by iterating `content/index.json` at build time, not by querying anything at request time.
- **Cost ceiling:** **€10/month total**, permanently (ADR-0018). Free tiers only (Cloudflare Pages, GitHub Actions, Google Workspace already owned) — never add a paid service without discussing it first.

## Development methodology: Test-Driven Development (ADR-0009)

TDD (red → green → refactor) still applies, scoped to what's left:

| Layer | Scope | Tools |
|-------|-------|-------|
| Domain unit | `Article` aggregate, value objects — no I/O | pytest (`src/pipeline/`) |
| Pipeline | Sheet/Doc parsing, HTML→Markdown conversion, validation (once built) | pytest |
| Frontend unit | Page components, `lib/content.ts` loaders | Vitest + React Testing Library |
| E2E | Public-page visitor flows | Playwright (`src/frontend/e2e/`) |

## v1 scope vs phase 2

- **v1:** articles, categories, **tags**, **guests**, cover images, the Spotify link, SEO — all authored in Google Docs/Sheets, no admin UI.
- **Deferred indefinitely:** newsletter (signup/subscribers), comments, any authenticated surface.
- **Out of scope entirely:** hosting/streaming audio, RSS feed, i18n/multilingual, public user accounts.

## Git workflow

**Never push directly to `main`.** Always create a feature branch and open a PR. Branch protection is enforced — direct pushes will be rejected, but don't attempt them regardless.

## Commands

**Frontend** (`src/frontend/`, deps installed via `npm install`):
- Build (static export → `out/`): `cd src/frontend && npm run build`
- Tests: `cd src/frontend && npm test`
- Type check: `cd src/frontend && npm run typecheck`
- Lint: `cd src/frontend && npm run lint`
- Dev server: `cd src/frontend && npm run dev`
- E2E: `cd src/frontend && npm run test:e2e` (starts its own dev server; no Docker, no backend needed)

**Pipeline domain** (`src/pipeline/`, Python venv at `src/pipeline/.venv`):
- Tests: `cd src/pipeline && .venv/bin/python -m pytest -q`

The working directory is on Windows; available shells are PowerShell (primary) and a Bash tool for POSIX scripts.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gweedo/allarounder`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default mattpocock/skills label vocabulary (no overrides). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at repo root + ADRs at `docs/architecture/adr/`. See `docs/agents/domain.md`.
