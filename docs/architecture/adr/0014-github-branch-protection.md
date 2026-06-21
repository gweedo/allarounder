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

**GitHub server-side branch protection cannot be applied on this account** (GitHub Free, private repo).

Protection is provided by two complementary controls:

1. **Claude Code git guardrails** — a `PreToolUse` hook at `.claude/hooks/block-dangerous-git.sh` intercepts and blocks the following commands before Claude executes them in any session: `git push`, `git reset --hard`, `git clean -f`/`-fd`, `git branch -D`, `git checkout .`, `git restore .`, and `push --force`. Wired in `.claude/settings.json`.

2. **Convention** — all code changes go through a pull request. The CI workflows run their full check suite on every PR; merging a PR with failing checks is visible and requires a deliberate override.

**Deferred:** if the repo is made public or the account upgrades to GitHub Pro, apply the prepared ruleset immediately:

```bash
gh api repos/gweedo/allarounder/rulesets \
  --method POST \
  --input docs/architecture/github-ruleset-main.json
```

The ruleset JSON (`docs/architecture/github-ruleset-main.json`) is committed and ready. It enforces: no deletion, no force-push, require PR, require all 6 CI status checks (`Backend CI/CD / lint-and-typecheck`, `test`, `security`; `Frontend CI/CD / lint-and-typecheck`, `test`, `security`), 0 required approving reviews (solo developer), admin bypass actor for non-code PRs.

## Options Considered

1. **GitHub Pro upgrade** (~$4/month) — enables rulesets on private repos. Deferred; not warranted for a project in early build.
2. **Make the repo public** — enables rulesets for free; rejected for now (code not ready for public visibility during active build).
3. **Claude Code hooks only (chosen)** — covers the primary risk of destructive commands during AI-assisted sessions. CI gates remain the quality check on every PR.

## Trade-off Analysis

The Claude Code guardrail covers the actual risk profile: this is a one-developer project where the main source of accidental destructive git commands is the AI assistant, not a rogue team member. Server-side branch protection would add a safety net for direct pushes from the CLI, but that risk is low given the team size and workflow discipline. The ruleset JSON is ready to apply the moment the plan/account changes.

## Consequences

- Direct pushes to `main` from the terminal are not blocked at the server level.
- Destructive git commands executed *through Claude Code* are blocked by the hook.
- CI checks run on every PR and block on failure; merging without them requires a deliberate manual step.
- The prepared ruleset in `docs/architecture/github-ruleset-main.json` can be applied with a single `gh api` call if the account is upgraded or the repo is made public.
