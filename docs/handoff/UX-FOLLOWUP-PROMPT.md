# Handoff prompt — UX audit follow-up: close the open points (Allarounder)

Paste everything below the line into a fresh Claude Code session in this repo.

---

## Context

**Allarounder** is an Italian written-articles blog that promotes the gymnastics
podcast **Double Double** on Spotify. Its job is to rank in Italian search and
send readers to Spotify (`docs/product/PRD.md`). It's a static Next.js site
(`src/frontend/`, `output: "export"`) on Cloudflare Pages, with content coming
from Google Docs through the pipeline (ADR-0018). Read `CLAUDE.md` first.

- Live preview: **https://allarounder-a5d.pages.dev** (auto-deploys from `main`).
- The previous session ran the UX audit in `docs/handoff/UX-AUDIT-PROMPT.md`.
  The owner (Guido) accepted all 14 items, and most of them are built and merged.
  This session closes what's left.
- A separate session owns **visual design** (palette, typography, header look):
  see `docs/handoff/DESIGN-REVIEW-PROMPT.md`. Before touching anything visual,
  check `gh pr list` and recent `globals.css` history for its work, and
  coordinate rather than restyle.

## What already shipped (2026-10-09, merged to `main`)

| PR | What |
|---|---|
| #141 | `app/_components/SiteHeader.tsx` in the root layout: skip link (`#contenuto`, every `<main>` carries that id), brand link home, `nav[aria-label=Principale]`, "Ascolta il podcast" link. The home `<h1>` is `.visually-hidden`. |
| #142 | `app/not-found.tsx`: an Italian 404 with a link home and the 3 latest articles. Also covers the `_vuoto` placeholders. |
| #143 | Article page: breadcrumb plus BreadcrumbList JSON-LD; a Spotify CTA linking to the episode, falling back to the show; "Altri articoli in ‹categoria›"; "Leggi anche" (`lib/related.ts`); `overflow-wrap` fix for long URLs on mobile. |
| #144 | `/articoli`, `/argomenti`, `/autori`, `/ospiti`, `/tag` index pages (`TaxonomyIndex`, `ArticleList`). The pipeline seeds all 4 fixed categories into `index.json`. Empty pages get `noindex, follow` (`lib/seo.ts`) and are left out of `sitemap.xml`. Home pagination was replaced by "Tutti gli articoli →". |
| #145 | Contatti suspended: no route, footer link or sitemap entry. `content/pages/contatti.md` is kept. |

`SPOTIFY_SHOW_URL` in `lib/site.ts` = `https://open.spotify.com/show/4E7Ax7kaEP3ZENYNW254l7`.

## Open points to solve, in suggested order

Verify each one before acting. State may have moved on since this was written
(2026-10-12).

1. **PR #146 — Articoli and Argomenti in the header nav.** It was open and green
   on 2026-10-12. Check it's still mergeable against `main`, then **ask Guido
   before merging**. If the design session restyled the header, rebase and
   re-check that the nav wraps cleanly at 390px.

2. **Playwright doesn't run in CI** (`.github/workflows/ci.yml` runs lint,
   typecheck, build, Vitest, pytest and audits only). That's how the homepage
   E2E test sat broken on `main` unnoticed. Add an E2E job:
   - Install Chromium only (`npx playwright install --with-deps chromium`).
   - Prefer testing the **static export** (`npm run build` then serve `out/`,
     with `BASE_URL` pointed at it) over `next dev`. Under `output: "export"`,
     `next dev` returns 500 for dynamic params missing from
     `generateStaticParams`, and cold route compiles needed 30s timeouts (see the
     comments in `e2e/homepage.spec.ts` and `e2e/not-found.spec.ts`). The
     `playwright.config.ts` `webServer` needs a variant for this.
   - Keep it inside free GitHub Actions minutes, and **report the minutes per
     run** (€10/month ceiling, ADR-0018). Decide with Guido whether it becomes a
     required check, because branch protection is his call.

3. **No automated accessibility check.** Add `@axe-core/playwright`, a dev
   dependency only, and an E2E spec that runs axe on `/`, an article, a
   category, `/argomenti` and the 404 page. Report the violations to Guido
   instead of silently fixing visual ones:
   - **Known failure:** `.spotify-callout` uses Spotify green `#1db954` as text
     on a light background, about 2:1, which fails WCAG AA. That fix is a
     colour decision, so it goes to the design session. Don't pick a colour
     yourself.
   - If the design work hasn't landed, you can mark the known contrast rules as
     expected failures with a comment that points to the design session.
   - A **manual screen-reader pass** (NVDA or VoiceOver) can't be automated.
     List it as unverified unless Guido does it.

4. **Design-session flags.** Make sure these reach the design session. They
   aren't yours to fix:
   - the `#1db954` contrast failure
   - the grey `.cover-image` placeholders, which take up most of the first
     screen on home when an article has no cover (neither live article does)
   - the hero title link in browser-default blue
   - the header's bottom border, limited to 1100px instead of full width
   - the header nav wrapping onto a second line on phones

   Check whether `DESIGN-REVIEW-PROMPT.md`, or that session's PRs, already
   cover them. If they don't, ask Guido how he wants them passed on: append to
   that prompt in a docs PR, or open a GitHub issue.

5. **Contatti stays suspended until Guido gives a real contact channel** (an
   email or a social handle). Today the page text points to "i canali social
   del podcast" with no link. When he provides one:
   - edit `content/pages/contatti.md`
   - re-add `"contatti"` to `KNOWN_SLUGS` in `app/[slug]/page.tsx`
   - restore the footer link in `app/layout.tsx` and the sitemap entry
   - flip the test in `app/[slug]/__tests__/static-page.test.tsx` back

   If he hasn't provided one, do nothing. Don't invent an address.

6. **Small cleanups (one PR):**
   - `.pagination-nav` and `.pagination-status` CSS in `globals.css` have no
     users left since #144. Delete them, but check the design session hasn't
     reused them.
   - Grep for any other leftover `<a href="/…">` internal links that should be
     `next/link`.

7. **Notes only, no build unless Guido asks:**
   - `_vuoto` placeholders (e.g. `/ospiti/_vuoto`) are served with **200** plus
     `noindex` instead of 404, a soft 404. Cloudflare Pages `_redirects` most
     likely can't return a 404 status. Check their docs and report back.
   - `/articoli` lists every article on one page. Path-based pagination
     (`/articoli/pagina/[n]` via `generateStaticParams`) is only worth building
     once the list gets long. `?page=` can't work under static export.
   - Privacy and cookie policy texts are development placeholders awaiting team
     review. Flag them; don't rewrite legal text.
   - The category open question ("Momenti di Sospensione": category or tag?)
     belongs to the creative team. Don't decide it.

## Constraints (settled — don't re-litigate)

- Static export only. Everything must be generatable at build time from
  `content/index.json` plus Markdown; `lib/content.ts` is the content contract.
  No search backend, no comments, no accounts.
- **Italian** UI copy and public URL slugs; **English** code, comments and
  commits.
- **TDD**: Vitest + React Testing Library for pages and loaders; Playwright in
  `src/frontend/e2e/` for visitor flows. Coverage gate: 80% lines. Every suite
  except `lib/__tests__/content.test.ts` mocks `lib/content.ts`.
- **€10/month ceiling**; free tiers only.
- **Never push to `main`**: branch from `origin/main`, open a PR, get required
  checks green, and **ask before merging**.

## Gotchas from the previous session

- The project hook `.claude/hooks/block-dangerous-git.sh` blocks any single
  command containing both `push` and ` main`, so `git push … && gh pr create
  --base main` gets rejected. Run them as **separate** Bash calls.
- Delete `.next/`, `out/` and `next-env.d.ts` before `npm run lint` after a
  local build.
- Page `<title>`s use `{ absolute: "X — Allarounder" }`. Dates go through
  `formatPublishDate()` (`lib/dates.ts`, Europe/Rome).
- A new dynamic route needs `generateStaticParams` via `slugParams()`
  (`lib/static-params.ts`).
- Cloudflare edge-caches pages that were removed from a deployment. After
  #145, `/contatti` kept serving the old page as a cache HIT
  (`s-maxage=604800`) for more than 9 hours and was gone within 3 days, while
  `?x=1` showed the real 404.
  When checking a removal live, add a query string.
- Screenshots: use Playwright from `src/frontend/` at viewports 1280×900 and
  390×844, save to the session scratchpad, and view them with Read.
- Before handing anything over as done, merge all open branches together in a
  throwaway `git worktree` and run the full suite. That caught nothing last
  time but is cheap insurance.

## Acceptance

- #146 merged (with Guido's OK) or explicitly parked.
- E2E running in CI, minutes per run reported, required-check decision made
  by Guido.
- An axe report on the key pages, with the visual violations handed to the
  design session.
- Design flags confirmed as received by the design session.
- Cleanups done; Contatti restored only if Guido gave a channel.
- A final report that lists everything not verified.
