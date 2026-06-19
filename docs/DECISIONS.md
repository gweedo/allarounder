# Decision Log — Podcast Blog Website

Last updated: 2026-06-14

---

## ✅ Final Decisions

### Build language: Python
- **Date**: 2026-06-14
- **Decision**: The application will be developed in Python (pivoting away from a WordPress-based approach).
- **Rationale**: Team feedback favored a custom Python application over a CMS-first WordPress build.
- **Status**: ✅ Final
- **Decided by**: Team

### Hosting platform: Azure
- **Date**: 2026-06-14
- **Decision**: The application will be hosted in Microsoft Azure (replacing the earlier Aruba/SiteGround plan).
- **Rationale**: Aligns with the move to a custom Python application and the team's preferred cloud environment.
- **Status**: ✅ Final
- **Decided by**: Team

### Site scope: written articles linking to Spotify
- **Date**: 2026-06-14
- **Decision**: The website publishes **written articles only**. The podcast audio lives on Spotify; each article links/redirects to the relevant Spotify episode. The site hosts no audio.
- **Rationale**: Spotify already hosts and distributes the podcast; the website's role is written content that drives listeners to Spotify.
- **Status**: ✅ Final
- **Decided by**: Team

### Team composition
- **Date**: 2026-06-14
- **Decision**: The team is 4 people: 1 developer (Guido, with programming experience) working alongside Claude, plus 3 members who write the articles and are not developers.
- **Implications**: Tooling for content creation must suit non-technical writers. Development and deployment are handled by an experienced developer.
- **Status**: ✅ Final
- **Decided by**: Team

### Python framework: FastAPI
- **Date**: 2026-06-14
- **Decision**: The backend will be built with **FastAPI**, serving a JSON API (headless architecture).
- **Rationale**: The team wants a robust, scalable foundation that starts as an MVP and can grow into a larger, more complex application. FastAPI is modern, async-first, and fast, with automatic API docs.
- **Trade-off noted**: FastAPI provides no built-in admin, ORM, or CMS. These must be assembled (SQLAlchemy + Alembic for data) and the editorial experience must be built deliberately (see Custom admin UI below).
- **Status**: ✅ Final
- **Decided by**: Team

### Frontend / rendering: separate Next.js app
- **Date**: 2026-06-14
- **Decision**: FastAPI serves as a pure API behind a **separate Next.js frontend**. Next.js renders the public site.
- **Rationale**: Decoupled architecture; flexible and scalable for future growth.
- **Implication**: SSR (server-side rendering) must be used in Next.js to preserve SEO, which is critical for a blog whose purpose is driving traffic to Spotify.
- **Status**: ✅ Final
- **Decided by**: Team

### Content management: custom admin UI
- **Date**: 2026-06-14
- **Decision**: The 3 non-technical writers will publish articles through a **custom-built admin UI**, rather than a headless CMS or Markdown-in-Git workflow.
- **Rationale**: Full control over the editorial experience and data model.
- **Trade-off noted**: This is the largest single chunk of build work — it rebuilds what Wagtail or a headless CMS would provide for free. It is the main driver of MVP timeline and the biggest risk for a single developer (see Risks).
- **Status**: ✅ Final
- **Decided by**: Team

### Azure compute service: Container Apps
- **Date**: 2026-06-14
- **Decision**: The application(s) will run on **Azure Container Apps** (containerized).
- **Rationale**: More control and portability than App Service; fits a headless API + separate frontend model and the goal of scaling into a larger, more complex system.
- **Implication**: Requires Docker images and container build/deploy pipeline setup.
- **Status**: ✅ Final
- **Decided by**: Team

### Database: Azure Database for PostgreSQL
- **Date**: 2026-06-14
- **Decision**: Data will be stored in **Azure Database for PostgreSQL**.
- **Rationale**: Standard, robust relational database; pairs cleanly with SQLAlchemy/FastAPI.
- **Status**: ✅ Final
- **Decided by**: Team

---

### Podcast / brand name: Allarounder
- **Date**: 2026-06-14
- **Decision**: The podcast and site brand name is **Allarounder**.
- **Pending**: Logo and full visual identity (colors, typography) not yet designed. Exact domains assumed to be `allarounder.it` (canonical) and `allarounder.eu` (redirect) — to confirm.
- **Status**: ✅ Final (name); 🔄 visual identity pending
- **Decided by**: Team

### Product definition (PRD) — topic, audience, goals
- **Date**: 2026-06-17
- **Decision**: Allarounder is a written platform about **artistic gymnastics** (expanding to sport in general). Audience: the **Italian gymnastics niche** (gym parents, gymnasts, insiders, enthusiasts, ~18–50), with a growth target of **generalists** reached via cross-over articles. The site's **primary goal is to drive listeners to the Spotify podcast and broaden beyond the niche**; secondary is growing the site's own readership. Discovery is Instagram-led today (+ Google/SEO for generalists). Captured from the content team's questionnaire.
- **Status**: ✅ Final (see `product/PRD.md`)
- **Decided by**: Team (content)

### Article categories (taxonomy)
- **Date**: 2026-06-17
- **Decision**: v1 categories are **Interviste, Analisi, Roundtable, Out of the Box** (the last for sport-adjacent / off-topic pieces).
- **Status**: ✅ Final
- **Decided by**: Team (content)

### Article–episode link is optional
- **Date**: 2026-06-17
- **Decision**: Not every article maps to an episode — `Article.spotify_url` is **nullable**. Some articles are standalone; some may seed future episodes. The Spotify block/CTA renders only when a link is present.
- **Status**: ✅ Final
- **Decided by**: Team

### Events in v1 (simple)
- **Date**: 2026-06-17
- **Decision**: Add a **simple Event content type** in v1 (title, date, location, description, optional link; informational only — no ticketing/registration), with `/eventi/` listing and admin CRUD. Plus an **Autori** (authors) public section.
- **Status**: ✅ Final
- **Decided by**: Team

### Launch timeline (target)
- **Date**: 2026-06-17
- **Decision**: Desired launch **September**; meaningful deadline is **ready before "Chiara's event" (second week of December)**. Editorial calendar runs as a side project.
- **Status**: 🔄 Provisional (target, not committed)
- **Decided by**: Team

### Content language: Italian only
- **Date**: 2026-06-14
- **Decision**: All blog content is in **Italian only** (no English/bilingual version for now).
- **Rationale**: The podcast and audience are Italian. Avoids the ~2x editorial workload of translation, translated data fields, and Next.js i18n routing.
- **Status**: ✅ Final
- **Decided by**: Team

### Codebase language: English
- **Date**: 2026-06-14
- **Decision**: All code, code comments, technical documentation, commit messages, and branch names are in **English**. This is separate from site content, which is Italian.
- **Note**: Public URL slugs (e.g. `/articoli/`) stay Italian for SEO — they are content-facing, not code. (Confirm if URLs should also be English.)
- **Status**: ✅ Final
- **Decided by**: Team

### Version control: GitHub
- **Date**: 2026-06-14
- **Decision**: Source code lives in **GitHub**.
- **Status**: ✅ Final
- **Decided by**: Team

### CI/CD: GitHub Actions
- **Date**: 2026-06-14
- **Decision**: Build and deployment run through **GitHub Actions**, deploying to **Azure Container Apps**. Pipeline builds the Docker image(s), pushes to a registry (Azure Container Registry), and deploys to Container Apps.
- **Status**: ✅ Final
- **Decided by**: Team

### CI/CD pipeline & deployment strategy (detailed)
- **Date**: 2026-06-14
- **Decision**: **GitHub Flow** branching (PR → checks; merge to `main` → staging; **manual approval** → prod). Path-filtered workflows run **lint/type-check → tiered tests** (unit+app+frontend+integration on PR, **80% coverage gate**; Playwright **E2E on staging**) **→ security scans** (pip-audit/npm audit/Dependabot, gitleaks+push protection, Trivy, CodeQL; **block on high/critical**) **→ build** (multi-stage, **immutable git SHA** tag + semver on release, deploy by digest) **→ deploy**. CI authenticates to Azure via **OIDC federated credentials**; apps read secrets via **Key Vault references + managed identity**. **Migrations** run as a **dedicated job before traffic shift** with **expand/contract + roll-forward**. Release uses **blue-green** (deploy green @ 0%, gate on health+smoke, flip 100%, instant revert to blue); **automated rollback** on thresholds (conservative, manual fallback until baselines). **Canary deferred to phase 2.**
- **Rationale**: Fast, safe, low-ceremony delivery for one developer with a clean path to scale; traceable images + blue-green + expand/contract make rollback trivial; OIDC + managed identity remove all long-lived secrets from CI.
- **Status**: ✅ Final (see ADR-0012)
- **Decided by**: Team

### Repository layout: monorepo
- **Date**: 2026-06-14
- **Decision**: A single **monorepo** on GitHub holds both deployables under a top-level **`src/`** folder: **`src/backend/`** (FastAPI) and **`src/frontend/`** (Next.js). GitHub Actions workflows are **path-filtered** so each app builds/deploys only when its folder changes. Each app is its own Docker image and its own Azure Container App.
- **Rationale**: Simpler to coordinate for a single developer; keeps API and frontend in sync; one place for issues, PRs, and shared config.
- **Status**: ✅ Final
- **Decided by**: Team

### Domain strategy: `.it` canonical, `.eu` 301-redirects to it
- **Date**: 2026-06-14
- **Decision**: The `.it` domain is the **canonical/primary** site; the `.eu` domain **301-redirects** to it. The same content is never served on both (avoids duplicate-content SEO penalties).
- **Rationale**: Italian-only content and an Italian audience make `.it` the natural primary; `.eu` is preserved and redirected to consolidate SEO equity.
- **Implementation**: Handle the redirect at the edge via **Azure Front Door** (redirect rule), provision **TLS certificates for both domains**, and set `<link rel="canonical">` to the `.it` URLs on every page.
- **Status**: ✅ Final
- **Decided by**: Team

### Authoring & content management: custom admin UI (re-affirmed)
- **Date**: 2026-06-14
- **Decision**: Writers author articles in a **custom admin UI on the site** (e.g. `allarounder.it/admin`); content lives in the EU Postgres via the FastAPI API. The full authoring landscape (git-based CMS, self-hosted headless CMS, SaaS headless CMS, Notion, Google Docs pipeline) was evaluated and the custom admin was re-affirmed for control and data ownership.
- **Fallback**: A self-hosted headless CMS (e.g. Payload/Directus) if the custom-admin build effort threatens the timeline.
- **Status**: ✅ Final (see ADR-0003)
- **Decided by**: Team

### Article body format: Markdown
- **Date**: 2026-06-14
- **Decision**: Article bodies are stored as **Markdown** (plain text). The custom admin provides a toolbar + live-preview editor so non-technical writers rarely see raw syntax; Next.js renders Markdown to HTML at view time. Modeled as a `Body` value object in the domain layer.
- **Rationale**: Safe-by-default (no stored-HTML/XSS surface), clean DDD/TDD fit, portable and editor-independent, SEO-neutral. Images stored as Blob Storage URL references, not embedded.
- **Status**: ✅ Final
- **Decided by**: Team

### Data model: Author is a profile optionally linked to a User
- **Date**: 2026-06-14
- **Decision**: `Author` (byline: name, bio, photo, links) and `User` (login account: email, hashed password, role) are **separate entities** with an **optional 1:1 link** (`Author.user_id`, nullable). A writer's User account maps to one Author profile; an Author can also exist **without** a User (guest/non-login bylines).
- **Rationale**: Keeps authentication concerns separate from public byline data, supports guest authors, and lets a login auto-provision its Author profile.
- **Status**: ✅ Final (see ADR-0011)
- **Decided by**: Team

### Publishing/scheduling: read-time filter (no scheduler service in v1)
- **Date**: 2026-06-14
- **Decision**: Scheduled publishing works via a read-time filter — the public API returns only `status = published AND publish_at <= now`. No cron/worker/scheduler service in v1. Modeled as a visibility rule on the `Article` aggregate.
- **Trade-off accepted**: A scheduled article appears within the cache-revalidation window (a few minutes), not to the exact second. A small revalidation job can be added later if to-the-minute publishing is ever needed.
- **Status**: ✅ Final
- **Decided by**: Team

### v1 scope vs phase 2
- **Date**: 2026-06-14
- **Decision**: **v1 includes** articles, categories, **tags**, **guests**, cover images, the Spotify link, the custom admin UI, and SEO. **Phase 2 (deferred):** **newsletter** (signup/subscribers backend) and **comments** (native commenting).
- **Rationale**: Keeps the core mission (written articles → Spotify) intact while controlling the custom-admin build effort. Tags and guests were kept in v1 by team choice. Newsletter and comments carry the most build/moderation/compliance overhead for the least near-term value.
- **Note**: Guest capability is committed for v1; the content team's answer on whether the show is interview-driven will refine how prominent guest pages are. An external embedded form remains an interim option for email capture before the phase-2 newsletter.
- **Status**: ✅ Final
- **Decided by**: Team

### Security architecture (ADR-0013)
- **Date**: 2026-06-18
- **Decision**: A layered security posture covering auth, secrets, upload safety, rendering, network, and access control. Key points:
  - **JWT in `httpOnly`/`Secure`/`SameSite=Strict` cookies** — JS never reads the token; immune to XSS exfiltration.
  - **30-min access token + 14-day rotating refresh token** — `refresh_tokens` table; revoked on logout/password change.
  - **Password policy** — 12-char minimum, HaveIBeenPwned breach check, soft lockout after 10 failures (5-min cooldown).
  - **Role boundaries** — `editor` manages own content only; `admin` has cross-author edit, delete, and user management.
  - **Next.js Middleware** protects `/admin/:path*` using `jose` (Edge-compatible); redirects to `/admin/login` on failure.
  - **CORS** — explicit allowlist (`allarounder.it` + staging); `allow_credentials=True`; no wildcard.
  - **Rate limiting** — WAF (1 000 req/min/IP volumetric) + `slowapi` per-endpoint (login 10/min, refresh 20/min, search 60/min, upload 10/min/user).
  - **Image uploads** — magic-bytes allowlist (JPEG/PNG/WebP/GIF only, no SVG); 10 MB limit; explicit `Content-Type` on Blob write.
  - **Markdown rendering** — `remark-rehype` (no raw HTML) → `rehype-sanitize`; raw HTML in article bodies is not supported.
  - **HTTP headers** — `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` in `next.config.js`; HSTS at Front Door. CSP deferred to post-launch hardening.
  - **Blob Storage** — private container; all image URLs through Front Door (`cdn.allarounder.it/...`); raw Blob URLs never exposed.
  - **WAF** — `Microsoft_DefaultRuleSet_2.1` provisioned in Bicep; Detection mode at launch → Prevention after burn-in.
  - **Secrets** — managed identity for Postgres and Blob (no passwords in Key Vault); JWT signing key is the only Key Vault secret.
  - **Audit logging** — deferred to phase 2.
- **Status**: ✅ Final (see ADR-0013)
- **Decided by**: Team

### Logging & observability: OpenTelemetry → Azure Monitor
- **Date**: 2026-06-14
- **Decision**: Instrument both apps with **OpenTelemetry**, exporting to **Azure Monitor / Application Insights** (Log Analytics in Italy North). **Structured JSON logs** to stdout; **W3C trace-context correlation IDs** across the frontend→backend hop; INFO+ in prod / DEBUG in dev; **PII & secret redaction** for GDPR; retention 30–90 days via Bicep. Logging stays out of the `domain` layer (DDD dependency rule); tests assert no secrets/PII are logged.
- **Rationale**: Vendor-neutral instrumentation, Azure-native and EU-resident, true distributed tracing across both services, low cost/ops — vs the deprecating classic App Insights SDK or an over-heavy third-party stack.
- **Status**: ✅ Final (see ADR-0010)
- **Decided by**: Team

### Environments: separate staging + production
- **Date**: 2026-06-14
- **Decision**: Run a **fully separate staging environment** (its own Container Apps environment, database, and config) in addition to production, both defined via Bicep. Releases are verified on staging, then promoted to production.
- **Rationale**: Complements TDD — tests verify code, staging verifies the environment (Azure config, Key Vault wiring, migrations against prod-shaped data, Front Door redirect, TLS, inter-service calls). Bicep makes the second environment a parameterized stamp; Container Apps scale-to-zero keeps idle cost low. Provides a safe place to rehearse migrations.
- **Status**: ✅ Final
- **Decided by**: Team

### Infrastructure-as-Code: Bicep
- **Date**: 2026-06-14
- **Decision**: Azure resources are defined as code with **Bicep** (in `infra/`).
- **Rationale**: Azure-native, no state file to manage (ARM is the source of truth), always current with new Azure features, low cognitive load for a single-cloud, solo-developer project. Terraform's multi-cloud advantage doesn't apply.
- **Note**: Provision Key Vault via IaC, but inject secret *values* through a secure step — never commit secrets to the Bicep files.
- **Status**: ✅ Final
- **Decided by**: Team

### Architecture approach: Domain-Driven Design (pragmatic)
- **Date**: 2026-06-14
- **Decision**: The backend follows **Domain-Driven Design**, applied pragmatically: **tactical DDD** (aggregates, value objects, repository interfaces, domain services) inside a **single core bounded context — Content/Publishing** — for v1. Layered architecture (`domain` / `application` / `infrastructure` / `interfaces`) with a strict dependency rule (the domain layer has no framework dependencies). Identity (auth) and Newsletter are supporting contexts to be split out later if they earn it.
- **Rationale**: Models the real domain logic (publishing lifecycle, slug rules, SEO invariants, Spotify-link validation) cleanly and keeps the core testable, while avoiding the ceremony of full strategic DDD for a mostly CRUD content site.
- **Trade-off noted**: Adds layers/indirection vs a plain CRUD app — upfront effort on top of the custom admin UI.
- **Status**: ✅ Final
- **Decided by**: Team

### Development methodology: Test-Driven Development
- **Date**: 2026-06-14
- **Decision**: Build using **TDD** (red → green → refactor). Backend tests with **pytest** across a test pyramid (domain unit tests with no I/O, application tests with fake repositories, integration tests against real PostgreSQL via **testcontainers**, API/contract tests). Frontend with Vitest + React Testing Library and Playwright for e2e. A coverage gate runs in CI before images are built.
- **Rationale**: Pairs naturally with DDD (fast domain unit tests), drives clean design, and guards against regressions as the system grows.
- **Status**: ✅ Final
- **Decided by**: Team

---

## 🔄 Provisional / Supporting Decisions

### Supporting Azure services
- **Date**: 2026-06-14
- **Decision**: Use **Azure Blob Storage** (cover/guest images), **Azure Key Vault** (secrets), **Application Insights / Azure Monitor** (telemetry, see ADR-0010), and **Azure Container Registry** (images). Deploy to the **EU region Italy North**.
- **Status**: ✅ Final (relied upon by the logging, environments, and IaC decisions)
- **Decided by**: Team

---

## ⚠️ Risks / Notes

- **MVP timeline risk**: The chosen stack (headless FastAPI + separate Next.js frontend + custom admin UI + Container Apps) is powerful and scalable but build-heavy for a single developer. The **custom admin UI** is the biggest effort and rebuilds functionality a CMS would provide for free. v1 admin scope covers articles (create/edit/publish, cover image, Spotify link) plus management of categories, tags, guests, and authors. Recommend building the article editor first and the taxonomy/guest/author screens as simple CRUD to control effort.
- **SEO**: With a Next.js frontend, server-side rendering (SSR) or static generation is required so articles are indexable.

---

## ❓ Open Questions

### ❓ Brand visual identity (in progress — other team)
- **Context**: Name is set (**Allarounder**). Logo, colors, and typography are being produced by the rest of the team and will be handed over.
- **Status**: In progress (not blocking backend/data-model work)
- **Owner**: Rest of the team (writers)
- **Target date**: Before frontend design work starts

### ❓ Article length unit & bands
- **Context**: The team said articles run "500–1800" without specifying characters vs words, or short/medium/long bands. Affects editorial guidelines (not the build).
- **Owner**: Team (content)
- **Target date**: Before content guidelines are finalized

### ❓ Success metrics & instrumentation
- **Context**: Primary goal is driving to Spotify + broadening reach, but concrete targets and tracking (CTR to Spotify, organic search traffic, new-visitor share) aren't defined yet.
- **Owner**: Team
- **Target date**: Before/at launch

---

## 📦 Superseded Decisions

### ~~WordPress / Aruba / SiteGround direction~~
- **Date superseded**: 2026-06-14
- **Note**: The original plan to build on WordPress with Aruba hosting (and SiteGround as a candidate dev platform) was replaced by the Python + Azure decision. Kept for history.

### ~~Recommended default stack: Django + Wagtail + App Service~~
- **Date superseded**: 2026-06-14
- **Note**: Claude's recommended starting stack was Django + Wagtail on Azure App Service. The team chose FastAPI + Next.js + custom admin UI on Container Apps instead, prioritizing a decoupled, scalable architecture. Kept for history.
