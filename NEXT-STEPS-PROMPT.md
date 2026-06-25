# Next-steps handoff prompt (Allarounder)

Paste the section below into a fresh session to continue. It is self-contained.

---

## Context (where things stand as of 2026-06-25)

**Staging is fully working end-to-end:** the database schema is migrated, an admin user exists, and
admin login works (`https://allarounder-staging-frontend.<env>.azurecontainerapps.io/admin/login`).
Getting there required a long chain of fixes — see `retrospective-skills-orchestrator-2026-06-25.md`
and `deploy-incident-2026-06-22.md` for the full account. Production has **not** been promoted and
carries the same latent issues staging did.

**Known gotchas to respect (these caused most of the pain — don't relearn them):**
- **Local `main` is diverged from `origin/main`.** Always branch from `origin/main`
  (`git checkout -b <name> origin/main`) and read deployed code with `git show origin/main:<path>` —
  never trust the local working tree. See memory `project-local-main-diverged`.
- **No direct pushes to `main`** — always branch + PR (memory `feedback-no-push-to-main`).
- **ACA Multiple-revision mode pins traffic.** `az containerapp update` creates a new revision at
  **0% traffic**; you must `az containerapp ingress traffic set ... --revision-weight <rev>=100` (or
  let the blue-green CI deploy do it). Always confirm which revision serves traffic before believing
  a test.
- **Bicep image params default to the hello-world placeholder.** A full `az deployment group create`
  must pass the current `backendImage`/`frontendImage` or it reverts the apps to the placeholder.
- **Some frontend env/secret state on staging was applied via `az` CLI** (frontend Key Vault role,
  `jwt-signing-key` secret, `API_URL`, `JWT_SECRET_KEY`) because the full Bicep deploy is currently
  blocked (see Task 1). The Bicep is the source of truth and already declares all of it; the next
  successful full deploy reconciles the drift.

## Task 1 — Fix the `acr-pull-assignments` idempotency bug (BLOCKS all full Bicep deploys)

A full `az deployment group create --template-file infra/main.bicep ...` currently fails in the
`acr-pull-assignments` module with `RoleAssignmentExists`: the AcrPull role assignments for the
backend and frontend identities already exist (from first provisioning) under names that differ from
the current `guid(acrRef.id, principalId, acrPullRoleId)`, and ARM forbids a second assignment for the
same principal+role+scope.

- **Why it matters:** it blocks every future infra change *and* the production promotion (Task 2).
- **Fix options (pick one, validate with `az bicep build`):**
  1. Reference the existing assignments as `existing` instead of creating them, or
  2. Make creation conditional / delete-and-recreate the two conflicting assignments so names converge
     on the deterministic `guid(...)`.
- **Acceptance:** `az deployment group create ... --parameters backendImage=<cur> frontendImage=<cur>`
  on staging completes without `RoleAssignmentExists`, and the staging apps keep their real images,
  Front Door stays on **Standard** (ADR-0015), and the frontend keeps `API_URL` + `JWT_SECRET_KEY`.
- Open it as a PR from `origin/main`.

## Task 2 — Promote to production (same playbook we ran on staging)

Production's DB is almost certainly empty (its migration job silently no-op'd like staging's did), and
its frontend has the same admin-login gaps. After Task 1 makes full Bicep deploys work:

1. **Merge any outstanding PRs**, then approve the **production** environment gate so the production
   deploy runs (migrations execute there for the first time).
2. **Verify the schema actually exists** (don't trust "job succeeded"): from the
   `allarounder-production-backend` Portal console, confirm `alembic_version` is at head and the
   tables (`users`, `articles`, …) exist.
3. **Bootstrap the production admin:**
   `python -m cli create-admin --email <email>` in the production backend console.
4. **Confirm the production frontend** got the new image (runtime `/api/*` route handler), `API_URL`,
   `JWT_SECRET_KEY`, and the frontend Key Vault role assignment — then test
   `POST /api/admin/auth/login` returns `200` + `Set-Cookie` and the browser login works.
5. Run `./infra/scripts/create-postgres-identity.sh production <prod-pg-server>` if not already applied
   (the schema-grant step must run once per environment).

## Task 3 (recommended hardening, not blocking)

- Add a **login smoke test** to the deploy pipeline: a real `POST /login` asserting `200` + `Set-Cookie`
  against the deployed stack (would have caught the entire admin-login marathon).
- Add a **migration round-trip** check is already in CI (`tests/test_migrations.py`) — keep it.
- Consider switching the frontend Container App to **single-revision mode** to remove the traffic-pinning
  footgun, and migrating JWT signing to **RS256** so the frontend middleware never needs the signing
  secret (see retro §4d).
- Resolve the local-`main` divergence (reset local `main` to `origin/main`) to stop the stale-branch
  footgun.

## First actions for the new session
1. `git fetch origin && git checkout -b fix/acr-pull-idempotency origin/main`
2. Read `infra/modules/acr-pull-assignments.bicep` and decide the fix approach (Task 1).
3. Confirm with the user before running any `az deployment group create` against staging/production.
