# Fix prompt — `publish.yml` before Phase D goes live

Run this **before** `NEXT-STEPS-PROMPT.md` (Phase D). Everything here is dormant
today because no credentials exist; all of it activates the moment they do.

Paste everything below the line into a fresh Claude Code session in this repo.

---

## Context

`main` holds the merged Drive-CMS rebuild (ADR-0018). `.github/workflows/publish.yml`
runs the pipeline on `repository_dispatch`, a nightly `0 3 * * *` cron, and
`workflow_dispatch`. It runs `python -m ingest.cli`, checks for generated content
changes, opens a PR, and ends with `gh pr merge "$branch" --auto --squash`.

Three defects in how that job sequences work. None has ever run for real.

## Hard constraints

- **Never push to `main`.** Branch, open a PR, let the required checks report.
- Code and comments in English; anything a writer reads stays Italian.
- **Do not create, mock, or commit credentials. Do not touch Cloudflare or DNS.**
- TDD — a test per fix.

## Fix 1 — The Sheet claims success before the content exists (most important)

PR #106 fixed exactly this bug *inside* the pipeline: `run()` now defers every
Sheet write until `save_index()` succeeds, so the Sheet can never claim success
for content that wasn't saved. The workflow reintroduces the same failure one
level up.

`python -m ingest.cli` writes `esito` to the Sheet during the pipeline step. The
content only reaches `main` later, via a PR that merges asynchronously — if CI
fails on it, or auto-merge never completes, the Sheet permanently shows
`✓ Pubblicato` for an article that never shipped. Same class of bug, same
consequence: writers trust a green tick that means nothing.

Extend the existing deferral across the workflow boundary:

- Split the `esito` write out of the pipeline run. Add a CLI option that writes
  the pending outcomes to a JSON file instead of the Sheet, and a second
  entrypoint that flushes that file to the Sheet.
- **Write failures and scheduled notices immediately** — a `✗` or `⏳` never
  claims something shipped, and writers should see errors fast.
- **Defer only the `✓ Pubblicato` messages** until the content PR is confirmed
  merged.
- When the diff step reports `changed=false` there is no PR, so flush everything
  immediately.
- If the merge never completes, the success `esito` is simply never written — the
  row keeps its old value and the next run retries it. That is the correct
  self-healing behaviour; do not add a "publish anyway" fallback.

## Fix 2 — `concurrency` does not span the merge

`concurrency: group: publish-content` serialises the *job*, but the job's last
step only *enables* auto-merge and exits. The merge lands later, outside the
group. So run N can release the slot with its PR unmerged; run N+1 then branches
from a `main` that lacks run N's content and rebuilds `index.json` from that
stale base. Both PRs merge and one run's index entries are lost or conflict.

Two triggers make this ordinary, not theoretical: a writer clicking Pubblica
while the 03:00 cron runs, and two writers publishing minutes apart.

After enabling auto-merge, poll the PR until it reports `MERGED`, with a sensible
timeout, and fail the job loudly if it does not. The job must not exit while its
own PR is still pending.

## Fix 3 — A stalled PR silently piles up nightly

Each run uses a unique branch (`content/publish-<run_id>`). If one PR stalls —
failed check, auto-merge disabled, conflict — the nightly cron does not notice:
the article is absent from `main`'s `index.json`, so the skip check does not fire,
and it opens another PR. Every night. All of them mutually conflicting, none
merging, nobody alerted.

Before opening a new content PR, check for an existing open `content/publish-*`
PR. If one exists, fail the run with a clear message naming it, rather than
opening a second.

## Fix 4 — Verify the settings auto-merge depends on

`gh pr merge --auto --squash` fails unless the repository allows **auto-merge**
*and* **squash merging**. Check both:

```
gh repo view --json autoMergeAllowed,squashMergeAllowed
```

If either is disabled, **stop and tell the user** which setting to enable — do not
change repository settings yourself, and do not work around it with an admin
bypass or a direct push to `main`.

## Fix 5 — Log the decision

An automated pipeline holding unattended merge access to `main` is a real
architectural decision that was never recorded. Add an entry to
`docs/DECISIONS.md` covering what auto-merge does, why it is acceptable here (the
ruleset requires 0 approvals and all four status checks still run on the content
PR, so nothing bypasses CI), and the trade-off — content reaches the live site
with no human in the loop.

## Acceptance

- A failed or stalled content PR leaves no `✓ Pubblicato` in the Sheet.
- Two overlapping runs cannot produce a lost or conflicting `index.json`.
- A stalled content PR stops the next run loudly instead of stacking a new one.
- Tests cover each of the three behaviours.
- All four required checks green; report anything you did not verify.
