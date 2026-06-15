# Allarounder — Site Structure & Data Models (Draft)

Last updated: 2026-06-14
Stack: FastAPI (headless API) · Next.js (SSR/ISR frontend) · custom admin UI · Azure PostgreSQL (SQLAlchemy) · Azure Blob Storage (images)
Language: Italian only · Canonical domain: `allarounder.it`

This is a draft for review. It covers the sitemap, data models, API surface, the article page layout, and SEO fields. The site publishes **written articles only**; each article links out to the matching **Spotify** episode. No audio is hosted.

---

## 1. Sitemap & URL structure

Italian URLs, since content is Italian-only.

```
Home                          /
Articoli (index)              /articoli/
  Single article              /articoli/{slug}/        → links out to Spotify
Argomenti (categories)        /argomenti/
  Category archive            /argomenti/{slug}/
Ospiti (guests)               /ospiti/
  Guest profile               /ospiti/{slug}/
Tag archive                   /tag/{slug}/             (tags are v1)
Chi siamo (about)             /chi-siamo/
Ascolta su Spotify            /spotify/                → 301/redirect to the Spotify show
Contatti                      /contatti/
Cerca (search)                /cerca/?q=...
Sitemap XML                   /sitemap.xml
Robots                        /robots.txt

Newsletter                    /newsletter/             (PHASE 2 — deferred)
```

Footer: Privacy Policy, Cookie Policy, social links, Spotify link.
Primary nav: Home · Articoli · Argomenti · Chi siamo · Ascolta su Spotify.

The `.eu` domain 301-redirects to the matching `.it` path at the edge (Azure Front Door).

---

## 2. Data models (PostgreSQL via SQLAlchemy)

No `Episode`/audio model — the Spotify link is just a URL field on the article. Cover images live in Blob Storage; the DB stores their URLs.

### Article (core)

| Field | Type | Notes |
|---|---|---|
| id | UUID / int PK | |
| title | varchar(200) | |
| slug | varchar(220) unique | auto-generated from title, editable |
| excerpt | varchar(300) | the "hook" / list-card summary |
| body | text | **Markdown** (decided); rendered to HTML by Next.js |
| cover_image_url | varchar | Blob Storage URL |
| cover_image_alt | varchar(160) | `Copertina articolo: {title}` default |
| spotify_url | varchar | link to the related episode (or show) |
| status | enum | `draft` / `scheduled` / `published` |
| publish_at | timestamptz | when it goes live (drives scheduling) |
| author_id | FK → Author | |
| category_id | FK → Category | one primary category |
| meta_title | varchar(60) | falls back to `{title} — Allarounder` |
| meta_description | varchar(160) | 140–155 chars |
| og_image_url | varchar | falls back to cover_image_url |
| reading_time | int | minutes, computed on save |
| created_at / updated_at | timestamptz | |

### Author

Byline/profile, **optionally linked 1:1 to a User** (`user_id` nullable) so guest/non-login authors are possible; a writer's User maps to one Author.

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| user_id | FK → User, nullable, unique | optional 1:1 link to a login account |
| name | varchar | |
| slug | varchar unique | |
| bio | text | |
| photo_url | varchar | Blob Storage |
| links | jsonb | socials, site |

### Category (Argomento)

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| name | varchar | |
| slug | varchar unique | |
| description | varchar(200) | shown on archive page |

### Guest (Ospite)

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| name | varchar | |
| slug | varchar unique | |
| bio | text | |
| photo_url | varchar | |
| links | jsonb | |

### Tag (in v1, for finer grouping alongside categories)

`id, name, slug` — many-to-many with Article via `article_tags`.

### Page (static: Chi siamo, Contatti, Privacy…)

`id, title, slug, body, meta_title, meta_description, updated_at`

### NewsletterSubscriber (PHASE 2 — deferred)

`id, email (unique), confirmed (bool), created_at` — double opt-in recommended. Not in v1; an external embedded form is the interim option for email capture.

### User (admin / editorial accounts)

`id, email (unique), hashed_password, role (admin/editor), is_active, created_at`
Three writers + Guido → `editor` role for writers, `admin` for Guido.

### Relationships

- Article *many-to-one* Author
- Article *many-to-one* Category
- Article *many-to-many* Guest  → join table `article_guests`
- Article *many-to-many* Tag    → join table `article_tags`
- Author *one-to-one (optional)* User → `Author.user_id` (nullable, unique)

**Body format:** **Markdown** (decided 2026-06-14) — stored as plain text, rendered to HTML by Next.js, modeled as a `Body` value object. Safe by default (no stored-HTML/XSS surface), portable, clean for DDD/TDD.

---

## 3. API surface (FastAPI)

Two surfaces: a **public read API** consumed by Next.js, and an **authenticated admin API** behind the custom admin UI.

### Public API (read-only, published content only)

```
GET  /api/articles?page=&page_size=&category=&tag=&q=     paginated list
GET  /api/articles/{slug}                                  single article
GET  /api/categories                                       all categories
GET  /api/categories/{slug}                                category + its articles
GET  /api/tags                                             all tags
GET  /api/tags/{slug}                                      tag + its articles
GET  /api/guests                                           all guests
GET  /api/guests/{slug}                                    guest + their articles
GET  /api/pages/{slug}                                     static page
GET  /api/search?q=                                        article search

POST /api/newsletter                                       { email } → subscribe   (PHASE 2)
```

Returns only `status = published` and `publish_at <= now`. Paginated responses include `{ items, total, page, page_size }`.

### Admin API (auth required — OAuth2 password flow / JWT)

```
POST   /api/admin/auth/login                  → access token
GET    /api/admin/articles?status=            list incl. drafts/scheduled
POST   /api/admin/articles                    create
GET    /api/admin/articles/{id}               fetch for editing
PUT    /api/admin/articles/{id}               update
DELETE /api/admin/articles/{id}               delete
POST   /api/admin/articles/{id}/publish       publish / schedule
POST   /api/admin/media                        upload image → Blob Storage, returns URL
CRUD   /api/admin/categories | /tags | /guests | /authors | /pages
```

- Auth: OAuth2 + JWT, password hashing (bcrypt/argon2). Roles enforced (editor vs admin).
- Media upload streams to Blob Storage and returns the public URL to store on the record.
- Scheduling: setting a future `publish_at` plus the read-time filter (`publish_at <= now` on the public API) makes articles go live automatically — no scheduler service in v1 (see DECISIONS.md).

---

## 4. Article page layout (Next.js)

URL: `/articoli/{slug}/`. Sections in order:

1. **Header** — H1 title, then date · author · category.
2. **Listen-on-Spotify block** — prominent "Ascolta su Spotify" button near the top (optional embedded player, but always keep a plain link).
3. **Body** — the written content (headings, images, pull quotes).
4. **Related episode recap** (optional) — short summary of the linked episode, guest mention.
5. **Closing Spotify CTA** — "Ascolta / Segui su Spotify".
6. **Related articles** — 3 cards from the same category.

Rendering: use **ISR (incremental static regeneration)** or SSG with on-publish revalidation for article pages — fast and fully indexable. Dynamic bits (search) can be SSR/client.

---

## 5. SEO fields & technical SEO

Per article (stored on the model, rendered by Next.js):

- **Meta title**: `{Article Title} — Allarounder`, under 60 chars.
- **Meta description**: 140–155 chars, ends with a mild CTA.
- **OG/social image**: `og_image_url`, falls back to the cover image.
- **JSON-LD**: `Article` schema injected per page; `Person` for guests/authors where relevant.
- **Canonical tag**: always points to the `allarounder.it` URL.
- **Alt text**: cover = `Copertina articolo: {title}`; guest photo = `Foto di {nome}`.
- **Internal linking**: each article links to ≥2 related articles + its category.
- Site-wide: `sitemap.xml` (auto-generated from published articles), `robots.txt`, clean Italian slugs.

---

## 6. Open choices in this draft (decide before building)

1. ~~**Body format**~~ — RESOLVED: Markdown.
2. ~~**Tags**~~ — RESOLVED: in v1, alongside categories.
3. ~~**Guests**~~ — RESOLVED: in v1 (prominence to be refined by the content team's format answer).
4. ~~**Newsletter**~~ — RESOLVED: phase 2 (external embedded form as interim).
5. ~~**Comments**~~ — RESOLVED: phase 2 / likely dropped (moderation load).

**v1 scope:** articles, categories, tags, guests, cover image, Spotify link, custom admin, SEO. **Phase 2:** newsletter, comments.
