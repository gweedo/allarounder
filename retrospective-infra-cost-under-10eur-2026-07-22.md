# Retrospective — dropping the bill under €10/mo (temporary, pre-launch) — 2026-07-22

## Why

Guido's personal budget dropped and the running Azure bill (staging ~€20-30/mo,
production ~€80-105/mo per `retrospective-infra-cost-review-2026-06-29.md`) is no
longer affordable, even though production isn't live yet (no DNS/Front Door cutover
to `allarounder.it`). This is a **hard ceiling of €10/mo for the whole bill**, not a
"nice to have" optimization pass — see the interview record in this session for the
full reasoning.

This is explicitly a **temporary, pre-launch measure**. Nothing here supersedes the
settled architecture in `docs/DECISIONS.md` / the ADRs — no new ADR was written for
this. When the product actually launches, this retrospective's decisions get
revisited deliberately, not left in place by default.

## What we found

The settled architecture (Azure Postgres Flexible Server + Front Door + always-on
Container Apps + ACR) has real, unavoidable floors even minimally configured:

| Component | Floor cost |
|---|---|
| PostgreSQL Flexible Server (`B1ms`, cheapest tier, 32 GB minimum storage) | ~€3.84/mo storage alone, even fully stopped |
| Front Door Standard (production only) | ~€31/mo flat, zero-traffic |
| Container Apps, `minReplicas: 1` (2 always-on apps) | ~€25-40/mo |
| ACR Basic | ~€4.50/mo flat |

Running both environments simultaneously, even after the June cost-optimization pass
(ADR-0015/0016, issues #72-76), floors well above €10/mo. Getting under €10/mo
required cutting structurally, not just picking cheaper SKUs.

## Decisions

1. **Production torn down for now.** Not live, no data worth preserving. Resource
   group is deleted entirely rather than kept running idle or merely scaled down —
   even fully stopped, its Postgres storage alone would cost ~€3.84/mo, and there's
   no benefit to keeping it warm for a launch date that isn't set. Reviving it is a
   deliberate, explicit action later (see `INFRA-GUIDE.md` § Production teardown for
   what that actually involves — it's not just a Bicep redeploy, the CI managed
   identities and OIDC federated credentials go with the resource group).
2. **`deploy-production` gated behind `workflow_dispatch`** in both `backend.yml` and
   `frontend.yml`, so routine merges to `main` don't fail trying to deploy to a
   resource group that no longer exists.
3. **Staging's PostgreSQL moved to Neon's free tier**, replacing Azure Database for
   PostgreSQL Flexible Server. Confirmed via `src/backend/app/infrastructure/database.py`
   that this needs zero backend code changes — the managed-identity/Entra-token path
   only activates when `AZURE_USE_MANAGED_IDENTITY=true`; with it `false`, the engine
   is a plain SQLAlchemy connection, which is exactly what a Neon connection string is.
   `infra/main.bicep` gained a `deployPostgres` parameter (gates the `postgres` /
   `postgres-admin` modules) and a `@secure() externalDatabaseUrl` parameter used
   instead. Fresh start — no data migrated from staging's old Azure Postgres instance.
4. **Azure Container Registry kept, GitHub Container Registry swap dropped.** Initially
   considered (ACR is ~€4.50/mo, no small fraction of a €10 budget), but recomputed
   after decisions #1 and #3 landed: staging's floor without ACR changes is already
   ~€6-7/mo (ACR + Blob Storage + Key Vault), comfortably under €10. GHCR would have
   touched ~15 reference points across both CI workflows plus Bicep's registry/identity
   wiring, for savings no longer necessary to hit the ceiling. Not worth the risk.
5. **`budgetAmount` in `staging.bicepparam` lowered to `10`** (from 30) — the alert
   should be calibrated to the actual €10 ceiling, not the pre-optimization
   steady-state the old value was sized against.

## What did NOT change

- Application code — zero changes needed for the Neon swap.
- Production's Bicep parameters or module wiring — it reverts to the same shape it
  had before, whenever it's re-provisioned.
- ACR / the registry pull path — unchanged, still managed-identity based.
- Any settled architecture decision in `docs/DECISIONS.md` or the ADRs.

## Manual follow-ups (not automatable from this repo)

1. [ ] Create a Neon project (free tier) for staging; get the connection string.
2. [ ] Before the next staging Bicep deploy: `export NEON_DATABASE_URL="postgresql+psycopg://...?sslmode=require"`,
   then run the Step 4 deploy command from `INFRA-GUIDE.md` — `staging.bicepparam`
   reads it via `readEnvironmentVariable('NEON_DATABASE_URL', '')`, never committed.
3. [ ] Run Alembic migrations against the fresh Neon database (no data to carry over).
4. [ ] Explicitly confirmed, separate destructive action (not bundled into this PR):
   `az group delete --name allarounder-production` — do this only when ready, since
   it also removes the CI managed identities and OIDC federated credentials for
   production (see `INFRA-GUIDE.md` § Production teardown).
5. [ ] Verify staging still deploys clean end-to-end on Neon before relying on it.

## Lessons

- **A currency-label fix (EUR vs USD) surfaced the real conversation.** What started
  as "these dollar signs should be euros" led to checking actual spend, which led to
  "can we even afford this," which is a different problem than mislabeled units.
- **Recompute before committing to a swap.** The GHCR decision looked necessary under
  one set of assumptions (production still costing something) and stopped being
  necessary once production was torn down — the fix was to re-check the arithmetic
  against the *current* set of decisions, not the set that was true two questions ago.
- **"Temporary" needs an explicit revert path, not just a good intention.** Bicep
  parameters (`deployPostgres`, `enableFrontDoor`-style flags) make "revert" a
  one-line flip instead of rebuilding modules from scratch — worth defaulting to that
  shape whenever a cost cut is meant to be reversible.
