# Next-steps handoff prompt (Allarounder)

Paste everything below the line into a fresh Claude Code session in this repo.
Supersedes every earlier version of this file.

---

## Context

**Allarounder** is an Italian written-articles blog promoting a gymnastics
podcast hosted on Spotify: **Google Drive as CMS + static Next.js on
Cloudflare Pages** (ADR-0018). The whole stack is live end to end:

- **D1–D4 done** (2026-10-07 → 10-09): the editorial Sheet + Apps Script
  "Pubblica" menu, the Google service account and repo secrets
  (`GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`, `PUBLISH_TOKEN`), real articles
  published through `publish.yml`'s self-merging content PRs, and the
  Cloudflare Pages project (https://allarounder-a5d.pages.dev, auto-deploys
  from `main`).
- Design B restyle shipped (PRs #158–#163); E1 (`ponytail` skill, PR #178)
  and E2 (context-handling research, `docs/research/claude-code-context-handling/`)
  are done.

What's left: **D5** (on hold) and **E3**.

## Task D5 — DNS cutover (ON HOLD)

**Do not propose or start this until the user says the site is ready.** When
they do, confirm again immediately before acting:

1. Move the `allarounder.it` and `allarounder.eu` zones to Cloudflare free
   (an apex custom domain on Pages needs Cloudflare DNS).
2. Add `allarounder.it` (apex + `www`) as Pages custom domains.
3. `allarounder.eu` → `allarounder.it` 301 via a Cloudflare redirect rule
   (ADR-0007).
4. Verify both over valid HTTPS, then HSTS.

**Acceptance:** `allarounder.it` serves the static site; `allarounder.eu`
redirects to it; both over valid HTTPS.

## Queued next steps (E1 → E2 → E3)

### E1, E2 — done

E1 installed `ponytail` (PR #178, a trial). E2's report,
`docs/research/claude-code-context-handling/README.md`, decides how E3 runs
(see "Context rules" below).

### E3 — Rethink the Google Docs → HTML conversion (deep brainstorm)

Big review of the whole chain: Doc export → HTML → Markdown
(`src/pipeline/`) → `lib/markdown.ts` → rendered HTML. Run it along the main
flow:

1. `/grill-with-docs` — deep brainstorm; record terms in `GLOSSARY.md` and
   any decision as a new ADR superseding the current conversion approach.
2. `/prototype` if a question needs a runnable answer (e.g. export a real
   Doc and diff each stage's output), bridged with `/handoff` both ways.
3. `/to-spec` → `/to-tickets`.
4. `/implement` — one fresh session per issue, given the PRD + that issue.

**Context rules (from E2):**

- Before starting, check `GLOSSARY.md` and the CLAUDE.md doc map are current
  (they were fixed for the pivot on 2026-10-18), then start E3 in a fresh
  session — CLAUDE.md edits only apply after a restart.
- Keep steps 1–3 in **one unbroken window**: no `/compact`, no `/clear`.
  Watch the token count with `/context`. This model auto-compacts only near
  ~967k tokens, so nothing stops you at the ~120k smart zone — if you pass it
  before `/to-tickets`, `/handoff` and continue in a fresh session instead.
- Delegate the code reading of the conversion chain (Doc export →
  `src/pipeline/ingest/` → Markdown → `lib/markdown.ts` → HTML) to a
  subagent that returns a summary with `file:line` pointers, so it never
  fills the main window. Use general-purpose agents for anything that needs
  CLAUDE.md; Explore/Plan agents skip it.
- `/handoff` writes to the OS temp dir, which may not survive a devcontainer
  rebuild: tell it to save under `.claude/handoffs/` (gitignored) instead.
- `/implement`: `/clear`, then one fresh session per issue with the PRD and
  that issue — the issue is the handoff. Finish with a fresh-context
  `/code-review`.

## Do not

- Create, commit, or mock any credential — the user generates every one.
- Cut over DNS without the explicit go-ahead described above.
- Modify the `Protect main` ruleset or use an admin bypass.
- Touch `fix/seo-meta-length-validation` or `docs/pivot-drive-static-archive`
  unless asked.
- Add any paid tier or service without discussing the €10/month ceiling
  first.

Report honestly what you did not verify, and stop at any point genuinely
blocked on a credential or a decision only the user can make.
