# ADR-0014: GitHub branch protection for `main`

**Status:** Accepted — Ruleset active (id 17948951, applied 2026-06-21)
**Date:** 2026-06-21
**Deciders:** Team (Guido, lead developer)

## Context

The repo uses **GitHub Flow**: all work happens on short-lived feature branches and merges to `main` via pull request. CI/CD workflows (ADR-0012) enforce lint, type-check, tests, and security scans on every PR — but these gates only run *after* a PR is opened. Nothing at the repository level prevents a direct push to `main`, a force-push that rewrites published history, or deletion of `main`.

GitHub provides two mechanisms to address this:

- **Repository rulesets** (modern): org- or repo-scoped, supports bypass actors, enforcement levels. Requires **GitHub Pro** for private repos.
- **Legacy branch protection rules**: per-branch, available since early GitHub. Also requires **GitHub Pro** for private repos.

Both were attempted via `gh api` and returned `HTTP 403 — Upgrade to GitHub Pro or make this repository public`.

## Decision

The repo was made **public** (2026-06-21), which unlocks GitHub rulesets on GitHub Free. A ruleset was applied immediately:

```bash
gh api repos/gweedo/allarounder/rulesets \
  --method POST \
  --input docs/architecture/github-ruleset-main.json
```

**Active ruleset id 17948951** enforces on `refs/heads/main`: no deletion, no force-push, require PR, require 4 CI status checks to pass (`Lint & type-check`, `Test (pytest)`, `Test (Vitest)`, `Security scan`), 0 required approving reviews (solo developer). Note: GitHub Rulesets match check runs by bare name (not `{workflow} / {job}` — that format only works in classic branch protection). Each bare name covers both backend and frontend jobs.

Protection is supplemented by:

1. **Claude Code git guardrails** — a `PreToolUse` hook at `.claude/hooks/block-dangerous-git.sh` intercepts and blocks destructive commands before Claude executes them: `git push`, `git reset --hard`, `git clean -f`/`-fd`, `git branch -D`, `git checkout .`, `git restore .`, `push --force`. Wired in `.claude/settings.json`.

2. **Convention** — all code changes go through a pull request. CI workflows run their full check suite on every PR.

**Bypass actor:** `gweedo` (user id 38251368, `bypass_mode: always`) is configured in the ruleset. This allows doc-only PRs — which don't touch `src/backend/**` or `src/frontend/**` and therefore never trigger the path-filtered workflows — to be merged using `gh pr merge --admin` without waiting for checks that will never run.

## Options Considered

1. **GitHub Pro upgrade** (~$4/month) — enables rulesets on private repos. Not chosen; making the repo public was free.
2. **Make the repo public + GitHub Ruleset (chosen)** — unlocks rulesets on GitHub Free; applied 2026-06-21 (id 17948951).
3. **Claude Code hooks only** — covers the primary risk of destructive commands during AI-assisted sessions but provides no server-side enforcement. Used as a supplementary layer.

## Trade-off Analysis

Making the repo public and activating the ruleset gives server-side enforcement (direct pushes, force-pushes, and merge-without-CI are blocked by GitHub) in addition to the Claude Code guardrails. The main cost is public visibility of the codebase during active build, which was accepted.

## Consequences

- Direct pushes to `main` are blocked server-side by the active GitHub Ruleset (id 17948951).
- Force-pushes and deletion of `main` are also blocked.
- PRs cannot be merged until all 4 required CI checks pass (`Lint & type-check`, `Test (pytest)`, `Test (Vitest)`, `Security scan`).
- Destructive git commands executed *through Claude Code* are blocked by the hook as an additional local layer.
- The ruleset JSON at `docs/architecture/github-ruleset-main.json` matches the active ruleset and can be used to re-apply it if ever deleted.
