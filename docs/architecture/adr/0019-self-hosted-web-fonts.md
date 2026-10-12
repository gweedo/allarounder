# ADR-0019: Self-hosted web fonts via next/font/local

**Status:** Accepted
**Date:** 2026-10-12
**Deciders:** Guido (solo developer)

## Context

Design direction B · Tabellone (`docs/DECISIONS.md`, PRD #151) needs three typefaces: **Barlow Condensed** for display headlines, **Literata** for reading, and **IBM Plex Mono** for meta lines. All three are open-source (SIL Open Font License 1.1) and published on Google Fonts. The site is a static export on Cloudflare Pages (ADR-0018), so fonts must be served as static files: there's no server, so a runtime font service could only be a third party.

The usual ways to load them each have a cost:

1. **Linking Google Fonts' stylesheet** makes every reader's browser request `fonts.googleapis.com` and `fonts.gstatic.com`, which sends their IP address to Google. In January 2022 the Munich Regional Court (LG München I, 3 O 17493/20) found that doing so without consent breaches the GDPR and awarded damages. A wave of warning letters to German site owners followed. The site's readers are in the EU.
2. **`next/font/google`** self-hosts the files in the output, but downloads them from Google **at build time**. Every build, including the unattended content-publishing builds, then depends on a network fetch that can fail or change the files.

The site also has a permanent €10/month ceiling (ADR-0018), so a paid font CDN is out.

## Decision

Commit the font files to the repository and load them with **`next/font/local`** in the root layout (`src/frontend/app/layout.tsx`):

- **Files:** Latin-subset woff2 files under `src/frontend/app/fonts/<family>/`, each folder holding the family's `OFL.txt` licence. Only the faces the design uses: Barlow Condensed 600 and 700; Literata 400, 400 italic and 700, as static files rather than the much heavier variable font; IBM Plex Mono 500. About 125 KB in total, of which a page downloads only the faces it uses.
- **Source:** the files are taken from the Fontsource 5.3.0 npm packages (`@fontsource/barlow-condensed`, `@fontsource/literata`, `@fontsource/ibm-plex-mono`). The Latin subset covers U+0000–00FF and the General Punctuation block (U+2000–206F), so it includes à è é ì ò ù, « », and the curly apostrophe and quotes the pipeline emits; this was checked against each file's character map with fontTools.
- **Wiring:** each family exposes a CSS variable on `<html>` (`--font-barlow-condensed`, `--font-literata`, `--font-plex-mono`), which `globals.css` maps into the `--font-display`, `--font-serif` and `--font-mono-ui` tokens. Only the root layout imports the fonts, so Vitest never runs the `next/font` loader.
- **Loading:** `display: swap`. To limit layout shift while a face loads, Barlow Condensed falls back to Arial with a computed `size-adjust` and Literata to a metric-adjusted Times New Roman. Plex Mono falls back to `ui-monospace` unadjusted: monospace fallbacks already share its character width. Only the display face is preloaded.
- **Caching:** Next.js emits the files under `/_next/static/media/` with content-hashed names. `public/_headers` gives `/_next/static/*` a `Cache-Control: public, max-age=31536000, immutable` header on Cloudflare Pages.

## Options Considered

- **Google Fonts stylesheet link.** Rejected: a third-party request on every page view, and the GDPR exposure described above.
- **`next/font/google`.** Rejected: no runtime request, but a build-time download makes builds non-reproducible and adds a failure point to unattended publishing.
- **`@fontsource/*` as npm dependencies, imported as CSS.** Rejected: it ships every subset and weight's `@font-face` rule unless each CSS file is imported by hand, and it bypasses `next/font`'s fallback metrics and preloading. The npm packages are used only as the source of the committed files.
- **System font stacks only.** Rejected: the design direction depends on the condensed display face; Barlow Condensed is much narrower than any system sans.
- **Self-hosted files via `next/font/local` (chosen).** No third-party request at runtime or at build time, reproducible builds, no cost, and `next/font` still provides hashing, preloading and fallback adjustment.

## Consequences

- No request leaves the site's own origin for fonts. An E2E check (`src/frontend/e2e/fonts.spec.ts`) asserts this on the home page and an Article page, and that all three families load.
- Updating a font means replacing committed binary files by hand; there's no dependency to bump. The faces are stable, so this is expected to be rare.
- Characters outside the Latin subset fall back to a system font. This already happens in one live Article, which quotes the Greek *agōn (ἀγών)*: those characters render in a system fallback font. If such text becomes common, add Literata's `latin-ext` or `greek` files.
- **Revisit if:** the site adds a language or content that needs another script, or the design changes typefaces.

## Action Items

1. [x] Commit the woff2 files and OFL licences, load them in the root layout, and map the tokens (#153).
2. [x] Add the long-lived cache rule for `/_next/static/*` to `public/_headers` (#153).
3. [ ] Confirm on the deployed site that Cloudflare Pages serves the `Cache-Control` header on font files.
