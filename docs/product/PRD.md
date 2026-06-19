# Allarounder — Product Requirements Document

**Status:** Draft v1
**Date:** 2026-06-17
**Owners:** Guido (developer) + content team (3 writers)
**Sources:** `content-team-questionnaire.md` (team answers, 2026-06)
**Related:** `../DECISIONS.md`, `../architecture/SITE-STRUCTURE.md`, `../architecture/TECH-SPEC.md`

This PRD defines *what* Allarounder's website is and *why*. The *how* is in the architecture docs. Site content is Italian; this document (a project artifact) is in English, with content-facing names kept in Italian.

---

## 1. Vision & mission

Allarounder is the most knowledgeable Italian voice on **artistic gymnastics**, expanding outward into **sport in general**. The website is the written-content hub of a polyhedric platform (podcast + articles + rubrics) whose mission is to give a **cultural and critical-thinking layer** to a niche that lacks a structured one — deepening existing fans' understanding and drawing in newcomers.

The name *All-arounder* (the gymnast who competes on every apparatus) evokes both breadth — covering the whole conversation on gymnastics and sport — and a 360°, multi-perspective way of looking at things. A recurring editorial value: cultivating the "grey zone" of nuanced, critical thinking in a polarized culture.

## 2. Problem & opportunity

- Italian gymnastics coverage is thin and stylistically dry (straight journalism); there is **no structured cultural layer**.
- Allarounder already produces a podcast that is **unique in Italy** (~50 episodes over ~2 years, ~1–1.5h each), but the team is, in their words, "the best at making it, the worst at promoting it."
- **Opportunity:** a written platform that (a) deepens the niche's understanding and critical sense, and (b) **reaches generalists** by connecting gymnastics themes to the wider world of sport.

## 3. Goals & success metrics

**Primary goal:** drive listeners to the **Spotify** podcast and **broaden the audience beyond the gymnastics niche**.

**Secondary goals:** grow the site's own readership; build a body of evergreen, search-discoverable articles.

**Strategy:** publish **cross-over articles** that tie an episode's theme to broader sport/athletes — e.g. episode 48's theme "accepting error" → an article on Jalen Brunson. This both serves the niche and creates entry points for generalists who then discover the podcast.

**Success signals (to instrument and target later):**
- Click-through from articles to the Spotify show/episodes (primary).
- Organic search traffic on cross-topic articles (generalist reach).
- Share of non-niche / new visitors.
- Returning readers and articles read per visit.

*(Newsletter signups are a phase-2 metric.)* Discovery today is **Instagram-driven** (niche); the website adds the **Google/SEO** channel to reach generalists — so strong **social share cards** and **SEO** both matter.

## 4. Audience

Core audience is the **Italian gymnastics niche**, roughly **18–50**:
- **Gym parents** (children in gymnastics)
- **Gymnasts** (athletes)
- **Insiders** (incl. Serie A commentators)
- **Enthusiasts**

**Growth target:** "generalists" — sport fans outside gymnastics — reached via cross-over content and search.

**Discovery:** Instagram (primary today), expanding to **YouTube**; Google for generalists. Language: **Italian only**.

## 5. v1 scope

### Site sections
- **Home**
- **Podcast** — a clear section linking/redirecting to the Spotify show.
- **Articoli** — the article archive, with categories: **Interviste**, **Analisi**, **Roundtable**, **Out of the Box** (sport-adjacent / off-topic pieces).
- **Autori** — author profiles (3 core writers + supervised external contributors).
- **Eventi** — a simple events listing.
- **Chi siamo** (About) and **Contatti**.

### Content types (v1)
Article (with an **optional** Spotify episode link), Author, Category, Tag, Guest, **Event (simple)**, and static Page.

### In / out for v1
- **In:** articles + categories + tags + guests + authors + **simple events** + the Spotify link + custom admin + SEO.
- **Phase 2:** newsletter (interim: external embedded form), comments.
- **Out entirely:** audio hosting/streaming/RSS, multilingual, public user accounts.

## 6. Content & editorial strategy

- **Episode linking is optional.** Some articles accompany an episode (with a Spotify link), some are standalone, and some may *seed* future episodes. The data model must allow an article with **no** episode link.
- **Cross-over approach:** connect gymnastics themes to broader sport to reach generalists and funnel them to Spotify.
- **Tone:** simple, clear, substance-first, **ironic**, no fluff — straight to the point.
- **Length:** experimental at launch, roughly **500–1800** (unit to confirm — see open questions); no fixed rule initially.
- **Authorship:** the 3 core writers write and peer-supervise each other; external "penne" contribute under supervision.
- **Editorial calendar:** the team plans a calendar for publishing continuity, run as a side project alongside work/study.
- **Style/structure references:** [uncleyanco.it](https://www.uncleyanco.it/), [athletamag.com](https://athletamag.com/it/), [ilpost.it](https://www.ilpost.it/) (style); [nova-lectio.com](https://nova-lectio.com/), [lucysullacultura.com](https://lucysullacultura.com/) (site structure).

## 7. Out of scope / phase 2

- **Newsletter** (interim: an external embedded signup form) and **comments**.
- **YouTube** integration (planned channel growth, not a site feature yet).
- Audio hosting/streaming, RSS feed, i18n/multilingual, public accounts (per existing architecture decisions).

## 8. Brand & design

- **Name:** Allarounder (set). Canonical domain `allarounder.it` (`.eu` redirects).
- **Visual identity** (logo, colors, typography): **in progress** by the team — initial brainstorming done, direction not yet finalized; hoped to land before a team member's ("Fabio") departure. Not blocking backend/data work.
- **Italian-only** content; SEO + social share cards are both important given Instagram-led discovery and the generalist-via-search goal.

## 9. Timeline & milestones

- **Desired launch:** **September** (ideal).
- **Meaningful deadline:** ready before **Chiara's event — second week of December**.
- **Dependencies:** brand-identity handoff; the editorial calendar; the custom admin UI (the largest build item, ADR-0003).

## 10. Open questions / dependencies

1. **Article length unit & ranges** — confirm whether "500–1800" is characters or words, and the intended short/medium/long bands.
2. **Success metrics** — define concrete targets and instrumentation (CTR to Spotify, search traffic, new-visitor share).
3. **Events scope** — confirmed simple (informational only, external registration link, no ticketing in v1; in-house registration deferred).
4. **Brand visual identity** — owned by the team, in progress (logo/colors/typography).
5. **"Out of the Box"** — modeled as an Article **category** (decided) rather than a separate subsystem; confirm this fits the editorial intent.

---

## 11. User stories

Actors: **Reader** (public visitor), **Editor** (one of 3 writers), **Admin** (Guido), **Search engine** (Googlebot).

### Reader

1. As a reader, I want to see the latest article as a hero on the homepage, so I can find new content immediately.
2. As a reader, I want to browse a paginated grid of recent articles below the hero, so I can scroll through past content.
3. As a reader, I want to read a full article page with the body rendered as HTML, so the content is legible and well-formatted.
4. As a reader, I want to see a prominent "Ascolta su Spotify" button near the top of an article when a Spotify link is present, so I can listen to the linked episode.
5. As a reader, I want standalone articles (no Spotify link) to display without a Spotify block, so the layout is clean when there is no episode.
6. As a reader, I want to see three related articles from the same category at the bottom of every article, so I stay engaged.
7. As a reader, I want to browse articles by category at `/argomenti/{slug}`, so I can filter by interest.
8. As a reader, I want to browse articles by tag at `/tag/{slug}`, so I can find related content.
9. As a reader, I want to view an author's profile at `/autori/{slug}` listing all their articles, so I can follow a writer.
10. As a reader, I want to view a guest's profile at `/ospiti/{slug}` listing all articles they appeared in, so I can follow a person across episodes.
11. As a reader, I want to share an article link on Instagram, WhatsApp, or iMessage and see a rich preview card (title, description, cover image), so my share attracts clicks.
12. As a reader, I want to visit `allarounder.eu` and be automatically redirected to `allarounder.it`, so I always reach the canonical site.
13. As a reader on mobile, I want article pages to be responsive and legible, so I can read on my phone.

### Search engine

14. As a search engine, I want every public article page to be server-rendered with full HTML content, so I can index it accurately.
15. As a search engine, I want each page to have a `<link rel="canonical">` pointing to the `allarounder.it` URL, so link equity is not split.
16. As a search engine, I want a sitemap at `/sitemap.xml` listing all published articles, authors, guests, categories, and tags, so I discover all content.
17. As a search engine, I want a `robots.txt` that permits crawling the public site and blocks the admin, so I only index public content.
18. As a search engine, I want each article to have JSON-LD `Article` schema, so I can display rich results.

### Editor

19. As an editor, I want to log in to the admin UI with my email and password, so I can access my content.
20. As an editor, I want to create a new article and save it as a draft, so I can start writing without publishing.
21. As an editor, I want the article slug to be auto-generated from the title as I type, so I don't have to type it manually.
22. As an editor, I want to edit the slug before first publish, so I can optimise it for SEO.
23. As an editor, I want the slug to be permanently locked once the article is published, so I never break live URLs.
24. As an editor, I want a Markdown editor with a toolbar (bold, italic, headings, links, images) and a live preview pane, so I can write without knowing Markdown syntax.
25. As an editor, I want to upload a cover image from my device, so it uploads directly to Azure Blob Storage and the URL is stored on the article.
26. As an editor, I want to paste a Spotify URL into the article form and have it validated, so I know the link is correct before publishing.
27. As an editor, I want to leave the Spotify URL field empty for standalone articles, so I can publish content not tied to an episode.
28. As an editor, I want to assign exactly one category to an article from the four seeded categories, so it appears in the right section.
29. As an editor, I want to add multiple tags to an article (creating new ones inline), so I can describe it with keywords.
30. As an editor, I want to attach one or more guests to an article from the guest list, so their profiles link back to this content.
31. As an editor, I want to click "Preview" on a draft article and have it open in a new tab rendered in the public layout, so I can inspect it before publishing.
32. As an editor, I want to publish an article immediately, so it goes live right away.
33. As an editor, I want to schedule an article by setting a future `publish_at` date/time, so it goes live without me being online at that moment (within the ISR revalidation window).
34. As an editor, I want to archive a published article, so it is hidden from the public site without being deleted.
35. As an editor, I want to edit any of my own drafts or published articles, so I can fix mistakes.
36. As an editor, I want to fill in an SEO meta title (≤60 chars) and meta description (140–155 chars), so I control how the article appears in Google.
37. As an editor, I want the meta title to fall back to `{Article Title} — Allarounder` and the meta description to fall back to the excerpt if I leave them blank, so defaults are always reasonable.
38. As an editor, I want to fill in an `og:image` URL, so I can use a different image for social sharing than the cover.
39. As an editor, I want `og:image` to fall back to the cover image if I leave it blank, so social sharing always has an image.

### Admin

40. As an admin, I want to create the first admin account via `docker compose exec backend python -m cli create-admin`, so I can bootstrap the system without a setup endpoint.
41. As an admin, I want to create and manage user accounts (email, role: admin or editor), so writers can log in.
42. As an admin, I want to read, edit, publish, and archive any article regardless of author, so I can moderate all content.
43. As an admin, I want to create, edit, and delete categories, so the taxonomy stays accurate (beyond the four seeded defaults).
44. As an admin, I want to create, edit, and delete tags, so the taxonomy stays clean.
45. As an admin, I want to create, edit, and delete author profiles (name, bio, photo, links), so bylines are accurate.
46. As an admin, I want to link an author profile to a user account (optional), so a writer's login auto-associates with their byline.
47. As an admin, I want to create, edit, and delete guest profiles (name, bio, photo, links), so episode participants are represented.
48. As an admin, I want to manage static pages (Chi siamo, Contatti, Privacy Policy, Cookie Policy) via the admin UI, so non-article content stays up to date.
49. As an admin, I want all services (backend, frontend, database) to start with `docker compose up`, so local development is simple.
50. As an admin, I want database migrations to run as a dedicated job before traffic shifts to a new deployment, so schema changes are applied safely with no downtime.
51. As an admin, I want the CI pipeline to block on failing tests or coverage below 80%, so regressions are caught before deployment.
52. As an admin, I want blue-green deployments so I can instantly roll back if a release has a problem.

---

## 12. Implementation decisions

### Stack & structure

- **Monorepo:** `src/backend/` (FastAPI) and `src/frontend/` (Next.js) under a single GitHub repo (`gweedo/allarounder`). `infra/` holds Bicep. `docker-compose.yml` at root runs all services.
- **Backend DDD layering:** `domain/` → `application/` → `infrastructure/` → `interfaces/`. Strict inward dependency rule: `domain/` imports no framework code (no FastAPI, SQLAlchemy, logging library). `Article` is the aggregate root.
- **Value objects on Article:** `Slug`, `Body` (Markdown), `SpotifyUrl` (optional, validated), `PublicationStatus`.

### Article domain rules

- `Article.status` is one of `draft` (default) / `published` / `archived`. There is no `scheduled` status — scheduling is a read-time filter: the public API returns `status = published AND publish_at <= now`.
- A `Slug` is auto-generated from the Italian title on create. It is mutable until the first publish transition, then permanently immutable. Any attempt to change a slug after publish raises a domain error.
- `Article.spotify_url` is nullable — standalone articles are valid domain objects.
- A `Preview` is a draft article renderable via a secret token URL in the public layout. The token is stored on the Article and is invalidated on publish.

### Auth

- OAuth2 password flow + JWT. Roles: `admin` (full access to all resources) / `editor` (can create, edit, and publish only their own articles; cannot manage users, authors, categories, or tags).
- First admin seeded via CLI command; no registration endpoint.
- Passwords hashed with bcrypt/argon2.

### Image uploads

- The admin requests a short-lived SAS token from `POST /api/admin/media/sas`. The endpoint returns `{ sas_url, blob_url }`. The browser uploads the file directly to Azure Blob Storage using the SAS URL. The backend stores only `blob_url` on the record. The backend never streams image bytes.
- Applies to: article cover images, author photos, guest photos.

### Data model (key fields)

**Article:** id, title, slug (unique, locked-on-publish), excerpt, body (Markdown text), cover_image_url, cover_image_alt, spotify_url (nullable), status, publish_at, preview_token (nullable), author_id (FK), category_id (FK), meta_title, meta_description, og_image_url, reading_time (int minutes, computed on save), created_at, updated_at. M2M: Tags via `article_tags`, Guests via `article_guests`.

**Author:** id, user_id (FK nullable, unique), name, slug, bio, photo_url, links (jsonb), created_at.

**User:** id, email (unique), hashed_password, role (enum: admin/editor), is_active, created_at.

**Category:** id, name, slug (unique), description. Seed rows: Interviste, Analisi, Roundtable, Out of the Box.

**Tag:** id, name, slug (unique).

**Guest:** id, name, slug (unique), bio, photo_url, links (jsonb).

**Event** (post-September launch): id, title, slug, starts_at (timestamptz), ends_at (nullable), location (nullable), body (Markdown), cover_image_url (nullable), cost (varchar nullable, display string e.g. "€10"), max_capacity (int nullable), registration_url (nullable), link_url (nullable), status (draft/published), created_at, updated_at.

**Page:** id, title, slug, body (Markdown), meta_title, meta_description, updated_at.

### Public API (FastAPI, read-only)

Returns only `status = published AND publish_at <= now`. All list endpoints are paginated with `{ items, total, page, page_size }`.

Key endpoints: `GET /api/articles`, `/api/articles/{slug}`, `/api/categories`, `/api/categories/{slug}`, `/api/tags/{slug}`, `/api/authors`, `/api/authors/{slug}`, `/api/guests`, `/api/guests/{slug}`, `/api/events`, `/api/events/{slug}`, `/api/pages/{slug}`.

### Admin API (FastAPI, auth required)

`POST /api/admin/auth/login` → JWT. Full CRUD on articles, categories, tags, authors, guests, events, pages, users. `POST /api/admin/media/sas` → SAS token for direct Blob upload. `POST /api/admin/articles/{id}/publish` sets `status=published` and `publish_at`. Role enforcement: editors cannot access `/admin/users`, `/admin/authors`, `/admin/categories`, `/admin/tags`.

### Frontend (Next.js)

- **Public pages:** SSR or ISR with on-publish revalidation. Homepage (hero + paginated grid), article page, category listing, tag listing, author profile, guest profile, static pages, `/eventi` listing + detail (post-launch).
- **Article page layout:** H1 title → date/author/category → Spotify CTA block (only when `spotify_url` present) → body → related articles (3, same category).
- **SEO per page:** `<title>`, `<meta name="description">`, `<link rel="canonical">` (always `.it`), `og:title`, `og:description`, `og:image` (falls back to cover image), JSON-LD `Article` schema.
- **Admin UI:** custom, hosted at `/admin`, protected by JWT. Article editor with Markdown toolbar + live preview pane, cover image upload via SAS token, slug auto-generate + edit-until-publish lock, Spotify URL field, category/tag/guest selectors, SEO fields, preview button, publish/schedule/archive actions. Taxonomy and guest/author CRUD screens as simple forms.
- **Preview:** `GET /preview/articles/{preview_token}` renders a draft article in the public layout; token is invalidated on publish.

### Infrastructure & CI/CD

- Docker Compose (all services) for local dev.
- Azure Container Apps (separate apps for backend and frontend), Azure Database for PostgreSQL (Flexible Server, Italy North), Azure Blob Storage, Azure Front Door (TLS, WAF, `.eu → .it` 301), Azure Key Vault (secrets via managed identity), Azure Container Registry.
- Bicep IaC in `infra/`. Separate staging and production environments, both stamped from the same Bicep.
- GitHub Actions: path-filtered workflows (`src/backend/**`, `src/frontend/**`). Pipeline: lint/type-check → tiered tests (80% coverage gate) → security scans → build image (git SHA tag, immutable digest) → deploy to staging → manual approval → deploy to production.
- Blue-green deployment; migrations run as a dedicated pre-traffic job (expand/contract pattern).
- OIDC federated credentials for CI→Azure auth; no long-lived secrets in CI.
- OpenTelemetry → Azure Monitor / Application Insights. Structured JSON logs (structlog backend, pino frontend). W3C `traceparent` across frontend→backend. PII/secret redaction at logging boundary. `domain/` layer emits no logs.

### Build sequence

1. **Monorepo scaffold** — directory structure, Docker Compose, CI skeleton, Bicep outline.
2. **Article domain model** — `Article` aggregate + value objects, TDD from domain unit tests.
3. **Article admin API** — CRUD + publish endpoint, auth, integration tests.
4. **Article admin UI** — create/edit form, Markdown editor, cover image upload, preview, publish.
5. **Public article pages** — homepage, article detail, category/tag listings.
6. **Author & guest management** — admin CRUD + public profile pages.
7. **Static pages** — Chi siamo, Contatti, Privacy, Cookie.
8. **SEO hardening** — JSON-LD, sitemap.xml, robots.txt, canonical tags.
9. **Events** (post-September) — domain model, API, admin CRUD, public listing/detail.

---

## 13. Testing decisions

### What makes a good test

Tests verify **external behaviour**, not implementation details. A test that breaks when you rename an internal method is a bad test. A test that breaks when the user-visible outcome changes is a good test.

### Test layers and seams

**Primary seam — API layer:** FastAPI endpoints tested via `httpx` + `testcontainers` (real PostgreSQL). This single seam exercises domain + application + infrastructure together and is where most feature behaviour for the backend is verified.

| Layer | Scope | Tools | What to test |
|---|---|---|---|
| Domain unit | `Article` aggregate, value objects — no I/O | pytest | Slug locking, status transitions, `publish_at` filter logic, `SpotifyUrl` format validation, preview token invalidation on publish |
| Application unit | Use cases against fake in-memory repositories | pytest | `CreateArticle`, `PublishArticle`, `ArchiveArticle`, `CreatePreviewToken` orchestration |
| API / integration | All public + admin endpoints, auth, role enforcement | pytest + httpx + testcontainers | Published-only filter, slug lock error, editor cannot manage categories, pagination, SAS endpoint response shape |
| Frontend unit | Article editor form, slug auto-generation, Markdown toolbar, preview link | Vitest + React Testing Library | Component behaviour against mocked API |
| E2E | Two critical paths (see below) | Playwright | Golden path + social card meta |

**Critical E2E flows:**
1. Editor logs in → creates draft → previews → publishes → reader visits public article page → Spotify CTA is present → JSON-LD and OG tags are correct.
2. Editor publishes article with no Spotify URL → public page renders without Spotify block.

**CI gate:** 80% coverage required before building/pushing images. Tests run on PR; E2E runs on staging post-deploy.

**No PII or secrets in logs:** asserted in integration tests via log capture.

---

## 14. Out of scope

| Feature | Status |
|---|---|
| Search (`/cerca/`) | Phase 2 |
| Newsletter backend (signup, subscribers) | Phase 2 (external embedded form is interim) |
| Comments | Phase 2 (may be dropped due to moderation cost) |
| In-house event registration / ticketing | Future version (v1 Events are informational only) |
| Audio hosting, RSS feed, embedded Spotify player | Out of scope entirely |
| Canary deployments | Phase 2 (blue-green is v1) |
| i18n / multilingual content | Out of scope |
| Public user accounts | Out of scope |
| Events section | Post-September launch (before December deadline) |

---

## 15. Further notes

- **Domain layer purity:** `domain/` must import no framework code. This is enforced by the test suite — domain unit tests run with zero framework imports.
- **Brand handoff:** logo, colors, and typography are in progress by the content team. Backend, domain model, API, and admin scaffolding can all proceed before the handoff. Frontend design is blocked until assets arrive.
- **Category seeding:** the four categories (Interviste, Analisi, Roundtable, Out of the Box) are seeded via a migration, not created through the admin UI at launch.
- **Timeline:** September soft launch target (articles + admin); Events section live before Chiara's event (second week of December).
