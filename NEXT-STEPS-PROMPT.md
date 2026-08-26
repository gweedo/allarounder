# Next-steps handoff prompt (Allarounder) — rebuild onto Drive + static

Paste everything below the line into a fresh Claude Code session in this repo.
It is self-contained. Supersedes the June 2026 version of this file, which
described the Azure deployment effort that has now been retired.

---

## Context

**Allarounder** is an Italian written-articles blog promoting a gymnastics
podcast hosted on Spotify. The site hosts no audio; each article optionally
links to an episode. SEO in Italian search is the product goal.

On **2026-08-26** the project pivoted. The June architecture — FastAPI HTTP API,
custom admin UI, Postgres, Azure Container Apps, Front Door, Bicep — is retired.
Read `docs/DECISIONS.md` (entries dated 2026-08-26) for the full rationale.
In short:

- The three writers work natively in **Google Docs** and will not move to a
  custom editor, which removed the user for the largest build item (ADR-0003).
- A permanent **€10/month ceiling**; production was already torn down in July.
- The developer has **3–6 hours a week**, against an architecture sized for far more.

**The new shape:** writers author in Google Docs, with a Google Sheet as the
editorial index. A GitHub Actions job exports the Drive folder, validates it,
generates Markdown, and publishes a **static** Next.js site to **Cloudflare
Pages**. No server, no database, no admin UI, no authentication.

The full plan, including the Sheet schema and what survives, is in the design
document — ask the user for the link if you need it.

## Hard constraints

- **Never push to `main`.** Branch from `origin/main`, open a PR, let the user merge.
- **Code, comments, commits, docs are English. Site content and content-facing
  routes (`/articoli/`, `/argomenti/`) are Italian.** Keep these separate.
- **Nothing that costs money.** Free tiers only. No Azure, no paid plans.
- **Decisions supersede, they never get rewritten.** New ADR + update
  `docs/DECISIONS.md`; never edit decision history in place.
- **TDD** is the project methodology (ADR-0009). Tests before implementation.
- **Do not touch `_record/`.** It is a gitignored local archive of the
  pre-rebuild application. Never delete it, never commit it.

## Gotchas — do not rediscover these

- `src/frontend/middleware.ts` exists (admin auth). **Middleware is incompatible
  with `output: "export"`.** It must be deleted, not adapted.
- `next.config.ts` currently sets `output: "standalone"` and a `headers:` block.
  **`headers:` does not work under static export** — those security headers must
  move to a Cloudflare `_headers` file or they silently vanish.
- `images.remotePatterns` points at Azure Blob Storage. Under export, set
  `images: { unoptimized: true }`; images become local files under `content/`.
- Public pages currently fetch the backend over HTTP at `${apiUrl}/api/articles/<slug>` and set
  `export const revalidate = 60`. Both go: replace with a filesystem read, and
  dynamic routes need `generateStaticParams`.
- The seven July feature branches are a **linear stack** (`session-persistence` →
  `admin-shell` → `markdown-lib` → `admin-crud-completion` → `public-styling` →
  `docs-paste-converter` → `google-sso`). Do not cherry-pick. Merge the tip and
  you get all of it.
- `fix/seo-meta-length-validation` is a **local-only branch**, one commit, never
  pushed. It contains the meta title/description length validation. There is **no
  `Seo` value object** in the domain layer — this branch is where that logic lives.
- Stack: Next 15.1 / React 19 / TypeScript, Python 3.13, remark+rehype with
  `rehype-sanitize` for Markdown.

## Task 0 — Archive the pre-rebuild application

`_record/` contains a bare mirror (11 branches, 203 commits, including PR refs)
and a verified bundle.

1. Create an empty `gweedo/allarounder-legacy` on GitHub — no README, no
   .gitignore, no licence.
2. `cd _record/allarounder-legacy.git && git remote set-url --push origin
   https://github.com/gweedo/allarounder-legacy.git && git push --mirror`
3. Archive it (read-only) via the GitHub API or `gh`.

**Acceptance:** all 11 branches visible on the new repo; it shows as archived.

## Task 1 — Merge the stranded stack into `main`

Roughly 40 commits of July work sit on branches and have never reached `main`.
Get them into history *before* anything is deleted.

1. PR from `origin/feat/google-sso` (the stack tip) into `main`.
2. Separately, push and PR `fix/seo-meta-length-validation`.
3. Resolve conflicts conservatively; do not refactor while merging.

**Acceptance:** `main` contains all seven branches' work plus the SEO validation
commit. CI green, or failures explained in the PR body.

## Task 2 — Strip to a static site

One PR. Large but mechanical.

**Delete:** `src/backend/` except the domain layer (see below); `src/frontend/app/admin/**`;
`src/frontend/app/api/[...path]/`; `src/frontend/app/preview/**`;
`src/frontend/middleware.ts`; `components/AdminShell.tsx`, `GuestForm.tsx`,
`MarkdownEditor.tsx`; `lib/api.ts`, `lib/upload.ts`; `infra/`;
`.github/workflows/{backend,frontend,postgres-staging}.yml`; `docker-compose.yml`
and Dockerfiles; the `jose` and `pino` dependencies.

**Keep and move:** `src/backend/app/domain/content/` → `src/pipeline/domain/`.
It holds `Slug` (with `from_title`), `Body`, `SpotifyUrl`, `PublicationStatus`,
and entities `Article`, `Author`, `Guest`, `Category`, `Tag`, `StaticPage`.
Keep its tests. Strip any framework imports that come with it.

**Keep untouched:** every public route (`app/page.tsx`, `articoli/[slug]`,
`argomenti/[slug]`, `autori/[slug]`, `ospiti/[slug]`, `tag/[slug]`, `[slug]`),
`app/sitemap.ts`, `app/robots.ts`, `app/globals.css`, `lib/markdown.ts`.

**Convert:** `output: "export"`, `images: { unoptimized: true }`, headers moved to
`public/_headers`. Replace each page's `fetch()` with a loader reading
`content/`. **The TypeScript interfaces already declared in those page files
define the JSON contract** — the pipeline must emit exactly that shape; do not
invent a new one. Add `generateStaticParams` to every dynamic route.

Ship it with a few committed sample articles in `content/` so the site builds and
deploys before the pipeline exists. Deploy to Cloudflare Pages and point
`allarounder.it` at it, with `allarounder.eu` 301-redirecting (ADR-0007).

Also in this PR: **write ADR-0018** recording the pivot and superseding
ADR-0001, 0002, 0003, 0004, 0005, 0013, 0015, 0016; update `adr/README.md`; and
**rewrite `CLAUDE.md`**, which is badly stale — it still claims no application
code exists.

**Acceptance:** `npm run build` produces static output; the site is live on the
real domain; `.eu` redirects to `.it`; no reference to FastAPI, Postgres, Azure
or authentication remains outside `docs/` history.

## Task 3 — The Drive pipeline

`src/pipeline/`, Python 3.13, TDD, running only in CI.

- Google service-account auth (Drive + Sheets, read-only on Drive).
- Read the editorial Sheet: one row per article, columns `titolo`, `doc`,
  `categoria`, `tag`, `autore`, `ospite`, `spotify`, `copertina`,
  `meta_description`, `data`, `stato`, `esito`.
- Publish only rows where `stato = Pubblicato` **and** `data <= now` — this is the
  read-time filter from `DECISIONS.md`, now applied at build time.
- Export each Doc via `files.export` with **`application/zip`** (HTML plus every
  embedded image in one request — more reliable than the Docs JSON for images).
  `text/markdown` is available for text-only pieces.
- Convert HTML → Markdown, extract images to `content/images/<slug>/`, and
  validate through the domain value objects. `meta_description` must be 140–155
  characters (see the `fix/seo-meta-length-validation` logic).
- Emit `content/articles/*.md` and `content/index.json` in the shape the site's
  TypeScript interfaces already declare. **Commit the generated content** — it is
  the audit trail and makes rollback a `git revert`.
- Reject bad input with a clear Italian message rather than emitting a broken page.
- `.github/workflows/publish.yml`: triggers on `repository_dispatch`, a nightly
  cron (for future-dated posts), and `workflow_dispatch`.

**Acceptance:** a real Doc becomes a live article. A Doc with a 100-character
meta description fails the build with a message a non-technical writer can act on.

## Task 4 — The Sheet and the “Pubblica” button

- Produce the Apps Script (in `tools/apps-script/`, committed) providing a
  **“Pubblica”** menu item that calls GitHub `repository_dispatch`.
- After the build, write the outcome back into the Sheet's `esito` column —
  `✓ Pubblicato 14:32` or `✗ meta description troppo corta (128, servono 140–155)`.
  Errors must be in **Italian**; writers read them.
- Add a **“Nuovo articolo”** item that creates a Doc from a template and fills in
  the row.
- Use data validation (dropdowns) for `categoria`, `autore`, `ospite`, `stato` so
  values cannot be typo'd. Categories: Interviste, Analisi, Roundtable, Out of the Box.
- Write `docs/product/editorial-workflow.md` **in Italian** — a one-page guide for
  the three writers.

**Acceptance:** clicking Pubblica publishes within ~2 minutes and the Sheet shows
the result.

## Credentials — stop and ask

You cannot obtain these. Ask the user, and do not invent, mock, or commit them:

- Google service-account JSON (Drive + Sheets)
- The Drive folder ID and the Sheet ID
- Cloudflare API token and account ID
- A GitHub PAT for Apps Script to call `repository_dispatch`

Secrets go in GitHub Actions secrets and Apps Script script properties. **Never
in the repo.**

## Working agreement

- One PR per task. Each PR body: what changed, what it deletes, how it was verified.
- **Stop and ask** before: deleting anything not listed above, adding a paid
  service, changing the Sheet schema, or touching `docs/DECISIONS.md` history.
- Log meaningful decisions in `docs/DECISIONS.md` as you go.
- Start with Task 0, and confirm with the user before starting Task 2 — it is the
  destructive one.
