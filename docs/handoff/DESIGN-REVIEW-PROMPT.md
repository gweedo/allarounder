# Handoff prompt — Design review: propose new designs (Allarounder)

Paste everything below the line into a fresh Claude Code session in this repo.

---

## Context

**Allarounder** is an Italian written-articles blog that promotes the gymnastics
podcast **Double Double** (on Spotify). Static Next.js site (`src/frontend/`,
`output: "export"`) on Cloudflare Pages, content authored in Google Docs and
published by the pipeline (ADR-0018). Read `CLAUDE.md` first.

- Live preview: **https://allarounder-a5d.pages.dev** (auto-deploys from `main`).
  Two real articles are live: `/articoli/never-be-afraid-to-fail`,
  `/articoli/appunti-di-agonismo`.
- Final domain `allarounder.it` is **not** connected yet (D5 paused — see
  `docs/DECISIONS.md` and the build-status notes; don't touch DNS).

## Goal of this session

**Propose new designs for the site, then implement the agreed one.** The owner
(Guido) decided on 2026-10-09:

1. **Scope: "fix bugs + polish"** — not a ground-up redesign. Fix the visual bugs,
   add a proper header with navigation and a Spotify call-to-action, polish
   spacing/typography.
2. **Branding: use the Double Double podcast identity** (its colours and logo),
   so blog and podcast read as one brand.

Start by **proposing 2–3 design directions** (palette, typography, header,
article card, article page) as mockups the owner can compare — e.g. a static
HTML page per direction, or screenshots of a local build — and get a choice
before changing `globals.css`. Then implement the chosen one in small PRs.

## Visual bugs already found (fix regardless of direction)

Seen in screenshots of the live site (desktop 1280px and mobile 390px):

1. **Home hero title is browser-default blue and underlined** — the hero's
   `<h2><a>` is unstyled (`app/page.tsx`, hero section).
2. **Empty grey placeholder boxes** where cover images go — no article has a
   `copertina`, so readers see large blank rectangles (hero and cards on the
   home page). Needs a designed fallback (or no image block when absent).
3. **Article page: tags row touches the body text** (no spacing below the
   `#agonismo #fatica …` chips); the category renders as a plain grey link.
4. **No site header / navigation** — only the bold word "Allarounder" on the
   home page; no menu, no link to the podcast. The root layout
   (`app/layout.tsx`) has only a footer.

## Brand assets (Google Drive)

Shared Drive folder `All Arounder/Loghi e assets grafici/Double Double/`
(folder ID `104SfLrg-NuyHNsqqI3L2Th90h4TS-nnQ`), owned by the podcast team:

- `DD_logo_horizontal@3x.png` (id `16_8J3ltZhSrHQT4BICwBOgM_QnD9S5qF`)
- `DD_logo_full@3x.png`, `DD_logo_full_white@3x.png`,
  `DD_logo_full_transparentbckgrd@3x.png`
- `DD_logo_outline_*`, `DD_anelli_*` (rings mark), `*_sfondoazzurro*`
  (on light-blue background — the podcast's brand colour)
- `DOUBLE DOUBLE_LOGOai.ai` (vector source), PDFs of each

The sibling folders `All Arounder/` and `Jump Out of the Box/` are **empty** —
the blog has no logo of its own yet.

The Google Drive connector can't render images and returns PNGs only as large
base64 blobs, so **ask Guido to download the logo PNG(s) you need into the
repo** (e.g. `src/frontend/public/brand/`) or to tell you the brand hex
colours. Don't guess the colours.

## Constraints (settled — don't re-litigate)

- **Styling = one global stylesheet with design tokens**
  (`src/frontend/app/globals.css`, `:root` custom properties). No Tailwind,
  CSS modules or CSS-in-JS — see `docs/DECISIONS.md` "Styling: single global
  stylesheet with design tokens". `globals.css` still contains classes for the
  retired admin UI; removing dead ones is in scope.
- Static export: no server features; `images: { unoptimized: true }`.
- **UI copy in Italian; code, comments, commits in English.**
- **€10/month ceiling**: web fonts only if free and self-hosted or from a free
  CDN, no paid services.
- **TDD** for any logic/component change (Vitest + RTL, `npm test`); a pure
  CSS change needs at least a screenshot before/after.
- **Never push to `main`** — branch, PR, required checks (Lint & type-check,
  Security scan, Test (Vitest), Test (pytest)) must pass. Ask before merging.

## Useful how-tos from the previous session

- **Screenshots of the live site** (Playwright is installed for E2E): a small
  script run from `src/frontend/` with `chromium.launch()`, viewports 1280×900
  and 390×844, `page.screenshot({ path })` into the session scratchpad, then
  view the PNGs with the Read tool. Must run from `src/frontend/` so
  `@playwright/test` resolves.
- Local build + screenshots of unmerged changes: `npm run build`, serve `out/`
  (e.g. `npx serve out`) and screenshot `http://localhost:3000`.
- `npm run lint` lints `.next/` and `next-env.d.ts` if a local build left them
  behind — delete those before linting (CI never has them).

## Acceptance

- The owner picked a direction from your proposals.
- The four bugs above are fixed; header with navigation + Spotify CTA exists.
- Before/after screenshots (desktop + mobile) in each PR description.
- All required checks green; report anything not verified.
