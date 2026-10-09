# Handoff prompt — Full UX audit and missing pages (Allarounder)

Paste everything below the line into a fresh Claude Code session in this repo.

---

## Context

**Allarounder** is an Italian written-articles blog that promotes the gymnastics
podcast **Double Double** (on Spotify); its purpose is to rank in Italian search
and drive readers to Spotify (`docs/product/PRD.md`). Static Next.js site
(`src/frontend/`, `output: "export"`) on Cloudflare Pages; content comes from
Google Docs via the pipeline (ADR-0018). Read `CLAUDE.md` first.

- Live preview: **https://allarounder-a5d.pages.dev** (auto-deploys from `main`).
  Two real articles: `/articoli/never-be-afraid-to-fail`,
  `/articoli/appunti-di-agonismo`.
- A separate session handles **visual design** (palette, typography, header
  look) — see `docs/handoff/DESIGN-REVIEW-PROMPT.md`. This session is about
  **structure, navigation, flows and missing pages**; coordinate rather than
  restyle.

## Goal of this session

1. **Full UX audit** of the public site as a reader (desktop + mobile): how a
   visitor from Google lands, reads, discovers more articles, and reaches the
   podcast on Spotify. Accessibility basics (headings, landmarks, focus,
   contrast, alt text), SEO-visible structure (titles, breadcrumbs, internal
   links), empty states, 404.
2. **List the missing pages and flows**, prioritised, then build the agreed
   ones in small PRs.

Write the audit as a short prioritised list the owner (Guido) can accept or
reject item by item **before** building anything.

## Facts already established (2026-10-09)

Routes that exist (`src/frontend/app/`):

| Route | Notes |
|---|---|
| `/` | home: hero + article cards |
| `/articoli/[slug]` | article page |
| `/argomenti/[slug]` | category page |
| `/autori/[slug]` | author page |
| `/ospiti/[slug]` | guest page |
| `/tag/[slug]` | tag page |
| `/[slug]` | static pages: `chi-siamo`, `contatti`, `privacy-policy`, `cookie-policy` |
| `robots.txt`, `sitemap.xml` | generated |

Known gaps (verify, don't assume):

- **No index pages** for `/articoli`, `/argomenti`, `/autori`, `/ospiti`,
  `/tag` — the section roots 404.
- **No site header / navigation** — the root layout (`app/layout.tsx`) has only
  a footer (Chi siamo, Contatti, Privacy, Cookie). No menu, no Spotify link.
- **404** is Next's default `/_not-found`, not a designed Italian page.
- Empty collections export a `/<section>/_vuoto` placeholder (noindex 404,
  `lib/static-params.ts`) — keep that mechanism working.
- Article pages: no "related articles" / next-read, no visible Spotify CTA
  unless the row has a `spotify` link (neither live article has one).
- Category list is fixed: `Interviste`, `Analisi`, `Roundtable`,
  `Out of the Box`. Open question for the creative team: whether
  "Momenti di Sospensione" is a category or a tag — don't decide it here.
- Privacy and cookie policy texts are development placeholders awaiting
  team review — flag, don't rewrite legal text.

## Constraints (settled — don't re-litigate)

- Static export only: every page must be generatable at build time from
  `content/index.json` + Markdown (`lib/content.ts` is the content contract).
  No search backend, no comments, no accounts (out of scope in the PRD).
- **Italian** UI copy and public URL slugs; **English** code/comments/commits.
- Styling via `globals.css` design tokens only (see the design handoff).
- **TDD**: Vitest + React Testing Library for pages/loaders; Playwright E2E in
  `src/frontend/e2e/` for visitor flows (`npm run test:e2e`).
- **€10/month ceiling**; no paid services.
- **Never push to `main`** — branch, PR, required checks green, ask before
  merging.

## Useful how-tos from the previous session

- Screenshot the live site with Playwright from `src/frontend/`
  (`chromium.launch()`, viewports 1280×900 and 390×844, save to the session
  scratchpad, view with the Read tool).
- A new dynamic section needs `generateStaticParams` via `slugParams()` from
  `lib/static-params.ts`, or an empty collection breaks the static build.
- Page `<title>`s use `{ absolute: "X — Allarounder" }` (the root layout's
  template would otherwise double the suffix); dates go through
  `formatPublishDate()` (`lib/dates.ts`, Europe/Rome).
- Delete `.next/`, `out/`, `next-env.d.ts` before `npm run lint` after a local
  build.

## Acceptance

- A prioritised audit the owner has accepted/rejected item by item.
- Agreed missing pages built (likely: section index pages, Italian 404,
  navigation structure), each with tests and green checks.
- Report anything not verified.
