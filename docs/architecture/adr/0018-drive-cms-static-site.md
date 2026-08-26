# ADR-0018: Google Drive as CMS, static site on Cloudflare Pages

**Status:** Accepted
**Date:** 2026-08-26
**Deciders:** Guido (solo developer)
**Supersedes:** ADR-0001 (Backend framework: FastAPI), ADR-0002 (Decoupled frontend: Next.js — SSR), ADR-0003 (Content management: custom admin UI), ADR-0004 (Compute: Azure Container Apps), ADR-0005 (Database: Azure Database for PostgreSQL), ADR-0013 (Security architecture), ADR-0015 (Front Door Standard tier), ADR-0016 (Front Door optional per-environment)

## Context

Three assumptions behind the June 2026 architecture no longer hold:

1. **The editorial workflow assumption was wrong.** ADR-0003 chose a custom admin UI so the three non-technical writers would have full control over the editorial experience. In practice, the writers work natively in Google Docs and do not want to learn a custom editor. This removes the user for the single largest build item in the project — the admin UI was already flagged as the main timeline risk in the original PRD.
2. **The cost ceiling changed.** A permanent €10/month budget is incompatible with always-on Azure compute, a managed Postgres instance, and Front Door. Production was already torn down in July 2026 to stay under this ceiling (`chore/infra-cost-under-10eur`), and staging's Postgres had already moved to Neon's free tier for the same reason.
3. **The time budget changed.** The developer has 3–6 hours a week available, against an architecture (FastAPI + Next.js + Postgres + Container Apps + Bicep, two environments, OIDC-federated CI/CD) sized for significantly more sustained engineering time.

Separately, static output serves the product's actual goal — Italian-language SEO — at least as well as SSR does, without the operational cost of keeping a server warm.

## Decision

Retire the runtime application entirely. The new shape:

- Writers author articles in **Google Docs**, indexed by a **Google Sheet** (one row per article: title, Doc link, category, tags, author, guest, Spotify link, cover image, meta description, publish date, status).
- A **GitHub Actions pipeline** (`src/pipeline/`, Python, triggered by a "Pubblica" button in the Sheet via `repository_dispatch`, plus a nightly cron for future-dated posts) reads the Sheet, exports each Doc, converts it to Markdown, validates it, and writes `content/articles/*.md` + `content/index.json` into the frontend's `content/` directory. Generated content is committed — it is both the audit trail and the rollback mechanism.
- The **Next.js app** (`src/frontend/`) builds with `output: "export"`, reading exclusively from `content/` at build time. No server, no runtime API, no database.
- The build deploys to **Cloudflare Pages** (free tier), with `allarounder.it` as the custom domain and `allarounder.eu` 301-redirecting to it (ADR-0007, mechanism changes from Azure Front Door to Cloudflare Page Rules / a redirect worker).
- There is **no admin UI, no authentication, no database, and no server** anywhere in the stack.

What survives from the retired architecture: the public Next.js routes and their SEO handling (unchanged), and the `Article`/`Author`/`Guest`/`Category`/`Tag`/`StaticPage` domain entities and value objects (`Slug`, `Body`, `SpotifyUrl`, `PublicationStatus`), moved from `src/backend/app/domain/content/` to `src/pipeline/domain/content/` with all framework-free — they become the pipeline's build-time content validator instead of a database-backed aggregate.

## Options Considered

- **Fix the FastAPI/Postgres/Azure stack's cost and build out the admin UI as planned (status quo).** Rejected: doesn't address either root cause — the writers still wouldn't use the admin UI, and the infra floor (even minimized, per the `chore/infra-cost-under-10eur` work) sits close to or above the ceiling before any compute is added back for production traffic.
- **Keep the custom admin UI, swap Azure for a cheaper always-on host (Fly.io, Railway, a single VPS).** Rejected: does not solve problem 1 (writers still need to leave Google Docs) and only partially solves problem 2; still asks for ongoing server operation against a 3–6 hour/week budget.
- **Headless CMS (Payload, Directus, Sanity) instead of a custom admin UI, keep the rest.** Rejected: still a Google Docs migration for the writers, still a runtime service to operate; it fixes the wrong problem.
- **Google Drive as the editorial system, static site generation (chosen).** Matches the writers' existing workflow exactly, drops all runtime infrastructure to zero, and fits a solo developer's available time — the entire "publish" step becomes a CI job, not an operational service.

## Consequences

- **Retired:** the FastAPI HTTP API, the SQLAlchemy/Alembic/Postgres persistence layer, the custom admin UI (article/author/guest/category/tag/pages CRUD screens, Google SSO, session persistence, the Google-Docs-paste-to-Markdown editor feature), Azure Container Apps, Azure Front Door, Azure Key Vault, Bicep IaC, and the two-environment (staging/production) CI/CD pipeline. Roughly two months of July development work is retired with this ADR, including seven feature branches that had never reached `main` — see the "Pre-rebuild application preserved as a frozen repository" decision in `docs/DECISIONS.md` for where that work is archived.
- **Publishing is no longer instant.** An article goes live when the pipeline's build finishes (~2 minutes after clicking "Pubblica"), not immediately on save. Scheduled ("future-dated") posts are handled by a nightly cron re-run rather than the read-time filter described in the original scheduling decision.
- **No more database.** All content is Markdown + JSON committed to the repository. There is no query layer — filtering (by category, tag, author, guest) happens by iterating `content/index.json` at build time.
- **No more authentication.** There is nothing to authenticate against — writers authenticate with Google, not with this system.
- **SEO field validation moves from request-time (422 on save) to build-time** (the pipeline rejects a bad Doc with an Italian-language error message and does not publish it, rather than the old admin UI's live character counter).
- **Cost drops to Cloudflare Pages' and GitHub Actions' free tiers** — comfortably under the €10/month ceiling with room to spare.
- **Revisit if:** the writers' volume or workflow needs change enough that build-time (rather than request-time) publishing becomes a real friction point, or if a future requirement (user accounts, comments, real-time content) reintroduces a genuine need for a server.

## Action Items

1. [x] Archive the pre-rebuild application to `gweedo/allarounder-legacy` (Task 0).
2. [x] Merge the stranded July feature-branch stack and the local-only SEO validation fix into `main` before deleting anything (Task 1).
3. [x] Strip the repository to a static site: delete the backend, admin UI, and Azure infra; move the domain layer to `src/pipeline/domain/`; convert the frontend to `output: "export"` with a filesystem-backed content loader; ship sample content (Task 2, this ADR).
4. [ ] Build the Drive/Sheets export pipeline (Task 3).
5. [ ] Build the editorial Sheet, the Apps Script "Pubblica" integration, and the writer-facing documentation (Task 4).
6. [ ] Point `allarounder.it` at Cloudflare Pages and configure the `.eu → .it` redirect — pending Cloudflare credentials (see `NEXT-STEPS-PROMPT.md`).
