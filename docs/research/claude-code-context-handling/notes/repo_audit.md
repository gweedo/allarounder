# Repo audit: how /workspaces/Podcast Blog Build loads context into Claude Code sessions

Method: read-only local inspection on 2026-10-18 (`wc -c`, `ls`, `cat`, `git ls-files`, `git rev-list`). Token estimates use ~4 chars/token. "Source" links are local file paths, since everything was checked by direct inspection. Measured environment: Debian 12 (bookworm) Linux devcontainer on WSL2 (`/etc/os-release`), bash shell.

Quick budget table (what is injected at session start vs on demand):

| Item | Bytes | ~Tokens | Loaded when |
|---|---|---|---|
| `CLAUDE.md` (repo root) | 9,018 (96 lines) | ~2,250 | every session (auto) |
| `memory/MEMORY.md` index | 2,626 (17 lines) | ~660 | every session (auto) |
| Repo skill frontmatter, 19 model-invocable skills | 5,319 | ~1,330 (upper bound; includes `name`/`license`/`argument-hint` fields) | every session (skill listing) |
| User-level synced skills (`~/.claude/skills/synced`, 17 skills) | 11,611 frontmatter | ~2,900 | every session (skill listing) |
| Synced plugin skills (`~/.claude/plugins/synced`, 33 skills) | 12,071 frontmatter | ~3,020 | every session (skill listing) |
| Memory topic files (16 files) | 54,021 | ~13,500 | on demand only |
| `NEXT-STEPS-PROMPT.md` | 11,819 (228 lines) | ~2,950 | on demand (not @-imported; pasted by user or read when referenced) |
| `CONTEXT.md` | 3,343 | ~840 | on demand (skills read it) |
| `docs/agents/*.md` (3 files) | 3,713 | ~930 | on demand |
| `docs/handoff/*.md` (3 files) | 20,571 | ~5,140 | on demand |

Rough always-on floor from these items: ~10,150 tokens (CLAUDE.md + MEMORY.md + ~7,250 of skill frontmatter). This leaves out the system prompt, tool schemas, MCP server instructions, and built-in skills, which are large in this environment (dozens of MCP tools are listed as deferred) but are not repo-controlled.

## CLAUDE.md (repo root): size, sections, stable vs volatile, duplication, staleness

### Takeaway
CLAUDE.md is a moderate 9,018 bytes (~2.25k tokens) and mostly holds stable rules. It has three factually stale items: a Windows/PowerShell line, "pipeline in progress" plus a "Task 3" pointer that no longer exists in NEXT-STEPS-PROMPT.md, and a documentation map that leaves out the live content contract. It also repeats several rules that appear again in NEXT-STEPS-PROMPT.md and in memory.

### Cited Findings
- Size: 9,018 bytes, 96 lines, 63 non-blank lines. No `@file` imports (grep for `@` found none), so it pulls nothing else into context. — [CLAUDE.md](../../../../CLAUDE.md)
- Sections, in order: What this repository is · The product in one paragraph · Two-language rule · Documentation map · Settled architecture (do not re-litigate) · Development methodology: TDD (ADR-0009) · v1 scope vs phase 2 · Git workflow · Commands · Agent skills (Issue tracker / Triage labels / Domain docs). — [CLAUDE.md](../../../../CLAUDE.md)
- Stable rules: the two-language rule, the settled-architecture bullets, TDD table, v1 scope, the "never push to main" rule, the €10/month ceiling, and the commands. Volatile/status content: "content pipeline (`src/pipeline/`, in progress — see `NEXT-STEPS-PROMPT.md` for the remaining build tasks)" (line 9) and "Content pipeline (`src/pipeline/`, Python, in progress) ... See `NEXT-STEPS-PROMPT.md` Task 3 for what's built vs outstanding" (line 37). Dated history sits in "What this repository is" ("As of 2026-08-26 (ADR-0018)", the list of what was removed and the legacy repo). — [CLAUDE.md](../../../../CLAUDE.md)
- **Stale: pipeline status.** NEXT-STEPS-PROMPT.md says the pipeline is built and tested ("tested (146 pytest cases), `ruff`/`mypy` clean"). The memory build-status file records it running live (D3 done 2026-10-09, first real article published). `src/pipeline/` contains `domain/`, `ingest/`, `tests/`, `data/`, `pyproject.toml`. — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md); [project-build-status.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-build-status.md`)
- **Stale: dangling "Task 3" reference.** NEXT-STEPS-PROMPT.md now has headings Task D1–D5 and E1–E3. There is no "Task 3". — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md) (grep of `^#` headings)
- **Stale: environment line.** Line 82 says "The working directory is on Windows; available shells are PowerShell (primary) and a Bash tool for POSIX scripts." The actual environment is a Debian 12 Linux devcontainer (WSL2 kernel), bash shell, cwd `/workspaces/Podcast Blog Build`. The same stale claim also appears in the user-level `~/.claude/settings.json` `autoMode.environment` block ("Windows, PowerShell primary + Bash tool"). — [CLAUDE.md](../../../../CLAUDE.md); [~/.claude/settings.json] (`~/.claude/settings.json`)
- Every file path CLAUDE.md references exists: `docs/DECISIONS.md` (53,235 B), `docs/architecture/adr/README.md` (3,217 B; 20 entries in the adr dir, latest 0019), `TECH-SPEC.md` (24,587 B), `SITE-STRUCTURE.md` (12,150 B), `docs/product/PRD.md` (24,620 B), `content-team-questionnaire.md` (3,434 B), `src/frontend/lib/content.ts`, `lib/frontmatter.ts`, `lib/markdown.ts`, `public/_headers`, `e2e/`, `src/pipeline/domain`, `src/pipeline/.venv`, the three `docs/agents/*.md`. The removed paths it lists as gone (`infra/`, `src/backend/`, `docker-compose.yml`) really are absent. — direct `test -e` checks
- **Gap in the documentation map:** `docs/architecture/CONTENT-CONTRACT.md` (18,687 B) is the live Sheet/pipeline/frontend contract that NEXT-STEPS-PROMPT.md cites repeatedly (§1, §3, §7, §8), but the map does not list it. `docs/handoff/` (3 prompt files) is not listed either. — [CONTENT-CONTRACT.md](../../../../docs/architecture/CONTENT-CONTRACT.md); [CLAUDE.md](../../../../CLAUDE.md)
- The map still points at TECH-SPEC.md and SITE-STRUCTURE.md (36.7 KB combined) while saying they describe the **retired** architecture and are "not yet rewritten for the pivot". — [CLAUDE.md](../../../../CLAUDE.md)
- Duplication: "Never push to main" appears in CLAUDE.md (Git workflow), in NEXT-STEPS-PROMPT.md (Hard constraints and Do not), and in memory `feedback-no-push-to-main.md`. The project hook enforces it as well. The two-language rule and the €10/month ceiling appear in both CLAUDE.md and NEXT-STEPS-PROMPT.md. The "Agent skills" section summarizes `docs/agents/*.md`. — [CLAUDE.md](../../../../CLAUDE.md); [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md); [feedback-no-push-to-main.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/feedback-no-push-to-main.md`)

### Inferences
- About 90% of CLAUDE.md is durable rules. The only status content is the two "in progress / Task 3" pointers plus the pivot-history framing, and these are what has gone stale.
- The Windows/PowerShell line can push Claude toward PowerShell syntax that does not exist in this environment. It is the clearest correctness problem.

### Gaps
- I could not measure how often sessions actually read TECH-SPEC/SITE-STRUCTURE/DECISIONS.md (53 KB, ~13k tokens if read whole) because of the "Read this first" instruction. Transcript analysis would be needed.

## Auto-memory (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/`)

### Takeaway
There are 17 files totalling 56,647 bytes. Only the 2,626-byte MEMORY.md index loads automatically. Of the 54,021 bytes of topic files, about 25.8 KB (~48%) is retired pre-pivot Azure/FastAPI history in four files, plus most of the largest file, and one memory (`project-local-main-diverged`) is now factually false.

### Cited Findings
- File sizes (bytes): `project-build-status.md` 20,231 · `project-prod-promotion-pending.md` 11,913 · `project-design-b-restyle.md` 5,973 · `MEMORY.md` 2,626 · `feedback-github-stacked-pr-retarget.md` 2,241 · `project-frontend-api-proxy.md` 1,745 · `feedback-track-infra-costs.md` 1,718 · `project-dockerignore-alembic-rootcause.md` 1,503 · `feedback-remote-plan-refinement.md` 1,274 · `project-local-main-diverged.md` 1,268 · `reference-apps-script-clasp.md` 1,196 · `project-editorial-google-account.md` 997 · `feedback-ask-before-substituting-action.md` 959 · `project-ponytail-trial.md` 912 · `feedback-git-hook-push-main-false-positive.md` 832 · `feedback-no-push-to-main.md` 704 · `user-profile.md` 555. Total 56,647. — [memory dir] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/`)
- MEMORY.md: 15 index entries plus a header, with line lengths 84–344 chars. Longest: the design-B line at 344 chars ("Tabellone; PRD #151, slices #152–#157; #152 merged (PR #158); #153 merged (PR #159); ... — Design B complete; worktrees go in .claude/worktrees"), which is a per-PR changelog inside an index line. Next longest: remote-plan-refinement 202, stacked-PR 197, ask-before-substituting 181, build-status 180. — [MEMORY.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/MEMORY.md`)
- **Retired by ADR-0018 (Azure/FastAPI/Postgres/ACA stack gone), still indexed:** `project-prod-promotion-pending.md` (11,913 B; its own description says "RETIRED ... do not act on it"), `project-frontend-api-proxy.md` (1,745 B; ACA revisions, `app/api/[...path]/route.ts`, JWT secret, which no longer exist under static export), `project-dockerignore-alembic-rootcause.md` (1,503 B; `src/backend/.dockerignore` and Alembic, now deleted), and `feedback-track-infra-costs.md` (1,718 B; Front Door/Azure $ figures, though its general "attach a cost estimate" rule still holds). — respective files in [memory dir] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/`)
- **Factually false now:** `project-local-main-diverged.md` says local `main` is "significantly diverged from origin/main". `git rev-list --left-right --count main...origin/main` returned `0 0` after a fetch on 2026-10-18. It also cites `cli/__main__.py` / `JoseTokenIssuer`, which is backend code that no longer exists. — [project-local-main-diverged.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-local-main-diverged.md`)
- **`project-build-status.md` (102 lines, 20,231 B), the largest memory:** its own text says "everything below this point (Azure/FastAPI/Bicep-era work) predates the 2026-08-26 architecture pivot ... Kept for history only". Sections: Phase D status (current, lines 15–29) · Drive/static rebuild merged 2026-08-28 · publish.yml fix PR #108 · then retired sections "Frontend UX / SSO / Docs-import initiative ... via ultraplan", "Cost-optimization initiative (issue #71)", "E2E integration suite (Docker Compose)", "Issue #16 details". The tail from "Frontend UX / SSO" onward is 9,711 B (~48% of the file). The Drive-rebuild section also says "Phase D ... is genuinely nothing-done-yet as of 2026-08-28", which its own Phase D section contradicts. Its frontmatter `description` ("issue completion track") does not match the current-status role the index line gives it. — [project-build-status.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-build-status.md`)
- **Duplicates repo content:** `feedback-no-push-to-main.md` restates CLAUDE.md's Git workflow rule (and the hook enforces it). The build-status Phase D section overlaps NEXT-STEPS-PROMPT.md's Phase D task list. Much of build-status's PR-by-PR narrative also exists in git/PR history and `docs/DECISIONS.md` (e.g. "Deferred esito writes and publish-run guards" is recorded in DECISIONS.md, per the memory text itself). — [feedback-no-push-to-main.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/feedback-no-push-to-main.md`); [project-build-status.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-build-status.md`)
- `project-design-b-restyle.md` (5,973 B): the work is finished ("Design B complete", #152–#157 all merged). It is now history and still indexed with a full per-PR log. — [project-design-b-restyle.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-design-b-restyle.md`)
- `user-profile.md` says "Works in VS Code devcontainer on Windows (WSL2)". That is accurate (WSL2 host), but compare it with CLAUDE.md's claim that the shells are PowerShell. — [user-profile.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/user-profile.md`)
- Still current and useful: `feedback-git-hook-push-main-false-positive.md` (matches the actual hook regex `push.*([ :]main(\s|$)|refs/heads/main)`), `reference-apps-script-clasp.md`, `project-editorial-google-account.md`, `project-ponytail-trial.md` (2026-10-18), `feedback-ask-before-substituting-action.md`, `feedback-github-stacked-pr-retarget.md`, `feedback-remote-plan-refinement.md` (behavioural rule; its example cites a retired plan). — files in [memory dir] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/`); [block-dangerous-git.sh](../../../../.claude/hooks/block-dangerous-git.sh)
- A second project memory location for cwd `src/frontend` (`~/.claude/projects/-workspaces-Podcast-Blog-Build-src-frontend/`) holds one 437 KB transcript and no `memory/` dir, so starting a session from `src/frontend` loads no auto-memory. — [dir] (`~/.claude/projects/-workspaces-Podcast-Blog-Build-src-frontend/`)

### Inferences
- The auto-loaded cost of memory is small (~660 tokens). The real cost is the risk that Claude opens a retired file (each index line invites a read) and gets stale or contradictory guidance. Four of the 15 index entries point at retired infra, and one points at a false claim.
- `project-build-status.md` works as a running changelog rather than a status snapshot, which overlaps the role of NEXT-STEPS-PROMPT.md.

### Gaps
- Topic files carry no read-count telemetry, so I cannot tell which memories sessions actually open.

## NEXT-STEPS-PROMPT.md: size, structure, role as cross-session handoff

### Takeaway
NEXT-STEPS-PROMPT.md is an 11,819-byte (~2.95k tokens), 228-line, git-tracked "paste into a fresh session" handoff. Most of its Phase D task text describes work that is already done (D1–D4 per memory, E1 per PR #178). What is still actionable is D5 (on hold), E2 and E3, plus the constraints, which repeat CLAUDE.md.

### Cited Findings
- Header: "Paste everything below the line into a fresh Claude Code session in this repo. Supersedes every earlier version of this file". 7 commits touch it; last commit 2026-10-18. — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md); `git log -- NEXT-STEPS-PROMPT.md`
- Structure: Context (lines 9–42) · Hard constraints (43–68) · Task D1 Sheet+Apps Script (69–91) · D2 service account+secrets (92–114) · D3 first real pipeline run (115–136) · D4 Cloudflare Pages (137–152) · D5 DNS cutover (153–166) · Queued next steps E1/E2/E3 (167–215) · Do not (216–228). — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md)
- The Context section is out of date. It says "Nothing has touched a real Google Sheet, a real Drive folder, or Cloudflare yet — no credentials exist anywhere in this project". The memory build-status file records D1, D2 and D4 done by 2026-10-09, D3 done 2026-10-09 (real article live), and the Pages URL `allarounder-a5d.pages.dev` live. D5 is on hold until Guido says the site is ready. — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md); [project-build-status.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-build-status.md`)
- E1 (install ponytail) is done: commit `e29ce3d` / PR #178, and `.claude/skills/ponytail/SKILL.md` exists. It is still listed as queued. E2 is the current context-handling research. E3 (Docs→HTML conversion rework) is still pending. — `git log`; [project-ponytail-trial.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-ponytail-trial.md`)
- Rough split by line ranges: D1–D4 (done) ≈ lines 69–152 (~84 lines, ~37%). Context (partly stale) ≈ 34 lines. Constraints + Do not (duplicating CLAUDE.md and adding credential/DNS rules) ≈ 39 lines. Still-actionable D5 + E2 + E3 ≈ 63 lines (~28%). (Approximation by heading line numbers.) — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md)
- Rules found only here (not in CLAUDE.md): never create/commit/mock credentials; confirm before the DNS cutover; don't modify the `Protect main` ruleset or use admin bypass; leave branches `fix/seo-meta-length-validation` and `docs/pivot-drive-static-archive` alone. — [NEXT-STEPS-PROMPT.md](../../../../NEXT-STEPS-PROMPT.md)
- CLAUDE.md refers to this file (lines 9 and 37) but does not import it, so it is not auto-loaded. Other handoff prompts sit in `docs/handoff/`: DESIGN-REVIEW-PROMPT.md 6,863 B, UX-AUDIT-PROMPT.md 4,602 B, UX-FOLLOWUP-PROMPT.md 9,106 B. Memory says the UX audit/follow-up work they describe is merged. — [docs/handoff](../../../../docs/handoff/); [project-build-status.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-build-status.md`)
- The repo root also holds tracked pre-pivot incident/retrospective files: `acr-pull-roleassignment-incident-2026-06-26.md` 10,041 B, `retrospective-improvements-runbook.md` 6,185 B, `retrospective-infra-cost-overprovisioning-2026-06-25.md` 4,303 B, `retrospective-infra-cost-review-2026-06-29.md` 4,921 B, `retrospective-skills-orchestrator-2026-06-25.md` 21,518 B. There is also a git-ignored `deploy-incident-2026-06-22.md` at 24,786 B. None of these is auto-loaded. — `wc -c *.md`, `git ls-files`

### Inferences
- The file serves as both a status board and a session-start prompt, but nothing updates its status when work lands, so it drifts. Memory build-status ends up being the more current status source, and the two disagree.
- If a session were seeded with this file as written, Claude could redo D1–D4 setup work or wrongly believe no credentials exist.

### Gaps
- I did not verify whether D5 status changed after 2026-10-13; memory is the only source.

## .claude/ directory: skills, settings, hooks, agents

### Takeaway
`.claude/skills/` holds 35 skills: 34 are symlinks into git-tracked `.agents/skills/` (mattpocock/skills set) and one is a real directory (ponytail). 16 are `disable-model-invocation: true`, so only 19 skill descriptions (5,319 B of frontmatter, ~1.3k tokens) load every session. There is one project hook (git guardrail) and no `.claude/agents/`. `settings.local.json` holds 4,508 B of mostly stale pre-pivot permission entries.

### Cited Findings
- 35 entries in `.claude/skills/`. 34 are symlinks `-> ../../.agents/skills/<name>` (dated Jun 21) and `ponytail/` is a real dir (SKILL.md + LICENSE). `.agents/skills/` contains 34 skills, all git-tracked. — `ls -la .claude/skills`; `git ls-files .agents`
- Skills with `disable-model-invocation: true` (16, user-invoked only, so their descriptions are not listed to the model): ask-matt, decision-mapping, edit-article, grill-me, grill-with-docs, handoff, implement, improve-codebase-architecture, prototype, setup-matt-pocock-skills, teach, to-issues, to-prd, triage, ubiquitous-language, writing-great-skills. — SKILL.md frontmatter scan
- Model-invocable (19), frontmatter bytes: codebase-design 301, design-an-interface 254, diagnosing-bugs 192, domain-modeling 252, git-guardrails-claude-code 290, grilling 184, migrate-to-shoehorn 208, obsidian-vault 189, ponytail 459 (multi-line `description: >` plus `argument-hint`, `license`), qa 304, request-refactor-plan 258, resolving-merge-conflicts 118, review 446, scaffold-exercises 243, setup-pre-commit 275, tdd 173, writing-beats 385, writing-fragments 391, writing-shape 397. Total 5,319 B ≈ 1,330 tokens. This set matches the repo skills shown in the current session's skill listing. — SKILL.md frontmatter scan
- Several always-listed skills have no obvious use in this repo: `obsidian-vault` (no vault), `scaffold-exercises` (course exercises), `migrate-to-shoehorn` (TS `as`-assertion test migration), `setup-pre-commit`, `git-guardrails-claude-code` (guardrail hook already installed), and the three writing-* skills (~1,173 B together). — SKILL.md descriptions; [.claude/hooks](../../../../.claude/hooks/)
- `ponytail` description: "Use on any coding task (writing, fixing, refactoring, reviewing, choosing dependencies)". That is a broad trigger. Memory notes a possible conflict between its "one small test" rule and ADR-0009 TDD. — [ponytail SKILL.md](../../../../.claude/skills/ponytail/SKILL.md); [project-ponytail-trial.md] (`~/.claude/projects/-workspaces-Podcast-Blog-Build/memory/project-ponytail-trial.md`)
- Skill body sizes (loaded only on invoke) range from 147 B (grill-me) to 9,063 B (writing-great-skills). Notable: teach 8,727, diagnosing-bugs 8,536, setup-matt-pocock-skills 6,611, codebase-design 6,488. — `wc -c` on SKILL.md files
- `.claude/settings.json` (260 B, tracked): a single `PreToolUse` hook on `Bash` running `"$CLAUDE_PROJECT_DIR"/.claude/hooks/block-dangerous-git.sh`. — [settings.json](../../../../.claude/settings.json)
- `.claude/hooks/block-dangerous-git.sh` (tracked): uses `jq` (present at `/usr/bin/jq`) and blocks force-push, `push ... main`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`, `restore .` with exit 2. It adds nothing to context except a stderr message when it blocks. — [block-dangerous-git.sh](../../../../.claude/hooks/block-dangerous-git.sh)
- `.claude/settings.local.json` (4,508 B, gitignored via `.gitignore:2`): ~90 `permissions.allow` entries, many for the retired stack, e.g. `az containerapp *`, `az postgres *`, `az bicep *`, `bicep build *`, `python -m pytest tests/api/test_*.py`, `python -m mypy app/...`, `mcp__claude_ai_Microsoft_Learn__*`, `xdg-open /tmp/architecture-review-20260620.html`, plus broad `Bash(bash *)`, `Bash(git *)`, `Bash(python3 *)`, `Bash(cd *)`. Permissions are not model context, but they are stale config. — [settings.local.json](../../../../.claude/settings.local.json)
- No `.claude/agents/` directory exists. There is `.claude/worktrees/` (6 worktrees: article-card-154-screenshots, article-page-156-screenshots, dd-brand-157-screenshots, fix+security-sprint, fonts-153-screenshots, header-155-screenshots; excluded via `.git/info/exclude`) and a `scheduled_tasks.lock` dated Aug 26. — `ls .claude`

### Inferences
- The repo's own skill listing costs ~1.3k tokens per session, which is modest. Pruning 6–9 irrelevant skills would save roughly 300–500 tokens. The larger always-on skill load comes from user-level and plugin skills (next section), not the repo.
- The 6 leftover worktrees are for merged Design B slices (#153–#157). They don't affect context unless a search tool walks into `.claude/worktrees/`.

### Gaps
- I did not check whether Claude Code's search tools ignore `.claude/worktrees/` (duplicate copies of the source tree could pollute grep results).

## CONTEXT.md and docs/agents/*.md

### Takeaway
CONTEXT.md (3,343 B, ~840 tokens) is the domain glossary that the mattpocock skills read on demand. Parts of it still use pre-pivot (admin/runtime) wording. `docs/agents/*.md` (3,713 B total) are small skill-config files that CLAUDE.md already summarizes, and `domain.md` contains stale examples.

### Cited Findings
- CONTEXT.md, 3,343 B: sections Language (Article, Body, Slug, PublicationStatus, Author, Guest, Episode, SpotifyUrl, Cover image, Event) and Taxonomy (Category, Tag). — [CONTEXT.md](../../../../CONTEXT.md)
- Pre-pivot wording in CONTEXT.md: Body is "rendered to HTML at view time" (now build time under static export). Slug is "editable until first publish, permanently locked once the article is published" (admin-UI semantics). Guest says "guest writers are modeled as Authors with no User account" (there are no User accounts at all under ADR-0018). It defines an **Event** entity that CLAUDE.md's entity list (Article, Author, Guest, Category, Tag, StaticPage) and v1 scope do not include. On the other hand, Author ("There is no login system (ADR-0018)") and Cover image (pipeline-extracted) were updated for the pivot. — [CONTEXT.md](../../../../CONTEXT.md); [CLAUDE.md](../../../../CLAUDE.md)
- `docs/agents/domain.md` (1,603 B): tells skills to read CONTEXT.md / CONTEXT-MAP.md / ADRs. Its example tree shows `0001-backend-framework-fastapi.md`, `0002-decoupled-frontend-nextjs.md`, "(0003–0012)", while the ADRs actually run to 0019. `CONTEXT-MAP.md` does not exist (single-context, which matches the file's own fallback). — [domain.md](../../../../docs/agents/domain.md)
- `docs/agents/issue-tracker.md` (1,065 B): `gh` CLI conventions. `docs/agents/triage-labels.md` (1,045 B): an identity mapping of the 5 default labels. CLAUDE.md's "Agent skills" section points to all three. — [issue-tracker.md](../../../../docs/agents/issue-tracker.md); [triage-labels.md](../../../../docs/agents/triage-labels.md)
- `.agents/skills/setup-matt-pocock-skills/` ships template copies (`domain.md`, `issue-tracker-github.md`, `triage-labels.md`, etc.), which explains where docs/agents came from. — `git ls-files .agents`

### Inferences
- These files cost nothing until a skill reads them. Their staleness (the Event entity, view-time rendering) matters mostly for E3's `/grill-with-docs` session, which will read CONTEXT.md as ground truth.

### Gaps
- None material.

## User-level context (~/.claude)

### Takeaway
There is no `~/.claude/CLAUDE.md`. User-level skill and plugin listings are the largest always-on skill cost, at ~23.7 KB of frontmatter (~5.9k tokens) across 50 synced skills, about 4.4 times the repo's own skill load. `~/.claude/settings.json` carries a long `autoMode.environment` block that repeats the stale Windows/PowerShell claim.

### Cited Findings
- `~/.claude/CLAUDE.md`: does not exist ("No such file or directory"). — `cat ~/.claude/CLAUDE.md`
- `~/.claude/skills/synced/<id>/`: 17 skills (built-in-browser, canvas-design, chrome-browser, computer-use, deep-research, doc-coauthoring, docs, docx, import-memory, morning, pdf, pptx, scout-trip-planner, skill-creator, theme-factory, web-artifacts-builder, xlsx). Frontmatter total 11,611 B (~2.9k tokens). — `find ~/.claude/skills/synced -name SKILL.md`
- `~/.claude/plugins/synced/<id>/`: 8 plugin dirs (cowork-plugin-management, design, engineering, gitkraken, miro, pdf-viewer, productivity, project-design-kit; manifest lists them with `.meta.json`). 33 SKILL.md, frontmatter total 12,071 B (~3.0k tokens). `installed_plugins.json` is empty (`"plugins": {}`). Marketplace plugins under `~/.claude/plugins/marketplaces/claude-plugins-official` are cached, not installed. — `~/.claude/plugins/`
- Several synced plugin skills overlap the repo's own skills: `project-design-kit:adr-writer` / `decision-tracker` / `tech-spec-writer` / `structure-designer` vs the repo's `domain-modeling` ADR flow; `engineering:code-review` vs built-in `code-review` vs repo `review`; `engineering:architecture` (ADR) vs `domain-modeling`; `productivity:memory-management` (a CLAUDE.md + memory/ two-tier system) vs Claude Code auto-memory. — current session skill listing
- `~/.claude/settings.json` (3,252 B): `enabledPlugins: {"cc-plugin-you-should-know@builtin": true}`, effort `medium` for claude-opus-5-5, `advisorModel: "opus"`, and an `autoMode.environment` array of ~22 lines describing the repo (public visibility, secret names, protected main, Cloudflare targets). One line says "assume Claude Code runs on an ordinary developer machine (Windows, PowerShell primary + Bash tool)". — [~/.claude/settings.json] (`~/.claude/settings.json`)
- Session transcripts: 29 `.jsonl` files in `~/.claude/projects/-workspaces-Podcast-Blog-Build/`. `~/.claude/history.jsonl` is 201,935 B. Neither is auto-loaded. — `ls ~/.claude/projects/...`

### Inferences
- Within the skill listing, the user/plugin level (~5.9k tokens) costs more than the whole repo level (CLAUDE.md + MEMORY.md + repo skills ≈ 4.2k tokens). Turning off unused synced plugins (e.g. miro, gitkraken, cowork-plugin-management, pdf-viewer, scout-trip-planner, morning) would save more per session than trimming CLAUDE.md. These are account-synced (claude.ai) rather than local config, so how to disable them may differ.
- The Windows/PowerShell misstatement appears in two independently loaded places (CLAUDE.md and autoMode.environment), so fixing only one leaves the other in place.

### Gaps
- The exact bytes the harness injects for each skill listing entry (description only vs full frontmatter, any truncation) are not visible locally. My figures are frontmatter bytes, an upper bound. Built-in skills and MCP tool/instruction text (Figma, Todoist, Docs, etc., visible in session) were not measured.
