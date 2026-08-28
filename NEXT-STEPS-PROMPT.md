# Next-steps handoff prompt (Allarounder) — Phase D: go live

Paste everything below the line into a fresh Claude Code session in this repo.
Supersedes every earlier version of this file — the Drive/static rebuild
(ADR-0018) is fully merged into `main`.

---

## Context

**Allarounder** is an Italian written-articles blog promoting a gymnastics
podcast hosted on Spotify, rebuilt onto **Google Drive as CMS + static
Next.js on Cloudflare Pages** (ADR-0018,
`docs/architecture/adr/0018-drive-cms-static-site.md`).

`main` now holds the whole rebuild:

- The static Next.js site (`src/frontend/`, `output: "export"`), building
  and passing lint/typecheck/tests/`npm audit --audit-level=high` clean.
- The content pipeline (`src/pipeline/`, Python) that reads the editorial
  Sheet, exports each Doc, converts it to Markdown, validates it against the
  domain layer, and writes `content/articles/*.md` + `content/index.json` —
  tested (146 pytest cases), `ruff`/`mypy` clean.
- The Apps Script source (`tools/apps-script/`) for the Sheet's "Pubblica" /
  "Nuovo articolo" menu, and the `.github/workflows/publish.yml` job it
  triggers via `repository_dispatch` (plus a nightly cron for future-dated
  posts).

All of that has only ever run against **fixture data** (the two sample
articles in `content/index.json`). **Nothing has touched a real Google Sheet,
a real Drive folder, or Cloudflare yet** — no credentials exist anywhere in
this project. ADR-0018's action items 4 and 5 (build the pipeline, build the
Apps Script integration) are done; **item 6 — point `allarounder.it` at
Cloudflare Pages — is what's left**, and it was blocked on exactly the
credentials this phase creates. (ADR-0018's action-item checklist itself
still shows items 4–5 unchecked — update it if you touch that file, but that
edit isn't part of this phase's acceptance criteria.)

Two branches exist outside this history and are intentionally untouched:
`fix/seo-meta-length-validation` and `docs/pivot-drive-static-archive`. Leave
them alone unless the user asks about them specifically.

## Hard constraints (unchanged from the rebuild)

- **Never push to `main`.** Branch, open a PR, let the required checks
  (`ci.yml`) run — the `Protect main` ruleset needs 0 approvals, so a PR with
  green checks can be merged without waiting on a human, but it still has to
  go through a PR.
- **Code, comments, commits, docs are English. Site content and
  content-facing routes (`/articoli/`, `/argomenti/`) are Italian.**
- **€10/month ceiling, permanently.** Free tiers only: Cloudflare Pages free
  tier, GitHub Actions free minutes, Google Workspace already owned. Stop
  and ask before adding anything that could cost money (a paid Cloudflare
  plan, a Google Cloud project outside the free API quota, etc.).
- **Never create, commit, or mock credentials yourself.** Every task below
  that needs a secret (a service-account key, a GitHub PAT, a Cloudflare API
  token) requires the user to generate it in the relevant console and hand
  it to you to paste into a secrets UI — GitHub Actions secrets or Apps
  Script script properties — never into a file that gets committed. If a
  task is blocked on a credential only the user can create, say so and stop;
  don't work around it.
- **Confirm with the user before the DNS cutover specifically.** Everything
  else in this phase is reversible (a GitHub secret can be rotated, a
  Cloudflare Pages project can be deleted, a test Sheet row can be deleted).
  Pointing `allarounder.it`'s DNS at Cloudflare is the one step that's
  visible to the outside world and not casually reversible — get explicit
  go-ahead before doing it, even if every earlier step went smoothly.

## Task D1 — Stand up the editorial Sheet and Apps Script

Mostly manual (Google Workspace UI), but you can generate exact content and
narrate each step. Follow `tools/apps-script/README.md` "Setup (once the
Sheet exists)" verbatim — it's already written for this:

1. Create the Sheet with columns in the exact order `CONTENT-CONTRACT.md` §1
   specifies: `titolo, doc, categoria, tag, autore, ospite, spotify,
   copertina, meta_description, data, stato, esito`.
2. Bind an Apps Script project to it (Extensions → Apps Script), push
   `tools/apps-script/src/*` via `clasp` or paste manually.
3. Set Apps Script script properties: `GITHUB_TOKEN` (fine-grained PAT,
   `gweedo/allarounder` contents: read, scoped to nothing else), `GITHUB_OWNER`
   (`gweedo`), `GITHUB_REPO` (`allarounder`). The user creates the PAT; you
   never see or store it.
4. Reload the Sheet, run "Configura validazione colonne" once.

**Acceptance:** the "Allarounder" menu appears in the Sheet; the `categoria`,
`stato`, `autore` dropdowns validate.

## Task D2 — Google service account + repo secrets

The pipeline needs a Google service account with **Drive read-only** and
**Sheets read/write** (`CONTENT-CONTRACT.md` §8) — the user creates it in
Google Cloud Console and shares the Sheet and Drive folder with its email.

1. User creates the service account, downloads the JSON key, shares Sheet +
   Drive folder with it (Viewer is enough for Drive; the Sheet needs Editor
   so the pipeline can write `esito`).
2. User (or you, with the value pasted into the CLI, never into a file) sets
   two GitHub Actions repo secrets: `GOOGLE_SERVICE_ACCOUNT_JSON` (the full
   key JSON) and `SHEET_ID` (the spreadsheet ID from its URL) — these are
   exactly what `src/pipeline/ingest/config.py` and `publish.yml` expect.

**Acceptance:** `gh secret list` shows both names (never their values) set
on `gweedo/allarounder`.

## Task D3 — First real pipeline run

1. Write one real test article as a Google Doc, add its row to the Sheet
   (`stato = Bozza` first to check validation, then `Pubblicato`).
2. Trigger a run: click "Pubblica" in the Sheet (fires
   `repository_dispatch`) or `gh workflow run publish.yml` for a manual
   `workflow_dispatch` test first — cheaper to debug from the CLI than from
   Apps Script's execution log.
3. Watch the Action run. It opens a `content/publish-<run_id>` branch, PRs
   it against `main`, and auto-merges once `ci.yml`'s required checks pass
   (`publish.yml`'s own comment explains why this doesn't violate "never
   push to main" — it's a PR like any other, just self-merging on green
   checks under the existing 0-approval ruleset).
4. Confirm the row's `esito` cell in the Sheet shows success, and that the
   generated `content/articles/<slug>.md` + `content/index.json` diff in
   that PR looks right before it merges (watch the first one closely — this
   is the first time real Drive content has gone through `html_to_markdown`
   and `validate_row`).

**Acceptance:** one real article's Markdown and metadata land on `main`
through the automated PR, matching what's in the Sheet and Doc.

## Task D4 — Cloudflare Pages

1. User creates the free Cloudflare account/project if none exists.
2. Connect the `gweedo/allarounder` repo (or configure via `wrangler` /
   direct upload if the user prefers not to grant Cloudflare a GitHub App
   install — ask which).
3. Build settings: build command `cd src/frontend && npm run build`, output
   directory `src/frontend/out`, no environment variables needed (per
   `.env.example`, the frontend build reads only `content/` on disk).
4. Deploy to Cloudflare's `*.pages.dev` preview URL first. **Do not touch
   DNS yet.** Check the preview: real pages render, images load, `/articoli/`
   and `/argomenti/` routes work, `robots.txt`/`sitemap.xml` are sane.

**Acceptance:** the `*.pages.dev` URL serves the site correctly, verified by
you actually loading it, not just a successful build log.

## Task D5 — DNS cutover (needs explicit go-ahead, see constraints above)

1. Confirm with the user immediately before this step, even if D1–D4 went
   without issue.
2. Point `allarounder.it` at the Cloudflare Pages project (custom domain in
   the Pages dashboard, or a CNAME/A record per Cloudflare's instructions).
3. Configure `allarounder.eu` → `allarounder.it` as a 301 redirect (ADR-0007
   — mechanism is now Cloudflare Page Rules or a small redirect Worker, not
   Azure Front Door).
4. Verify both domains resolve correctly and serve real content over HTTPS.

**Acceptance:** `allarounder.it` serves the static site; `allarounder.eu`
redirects to it; both over valid HTTPS.

## Do not

- Create, commit, or mock any credential (service-account key, PAT,
  Cloudflare token) — the user generates every one of these.
- Cut over DNS without the explicit go-ahead described above.
- Modify the `Protect main` ruleset or use an admin bypass.
- Touch `fix/seo-meta-length-validation` or `docs/pivot-drive-static-archive`
  unless asked.
- Add any paid tier or service without discussing the €10/month ceiling
  first.

Report honestly what you did not verify, and stop at any point genuinely
blocked on a credential or a decision only the user can make.
