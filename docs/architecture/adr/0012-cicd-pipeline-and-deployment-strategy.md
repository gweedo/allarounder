# ADR-0012: CI/CD pipeline & deployment strategy

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The system is a monorepo (ADR-0006) with two containerized apps deployed to Azure Container Apps (ADR-0004), built and shipped via GitHub Actions, with separate staging and production environments and TDD with a coverage gate (ADR-0009). This ADR specifies the full delivery pipeline: branching, the build/test/scan stages, image tagging, auth and secrets, database migrations, the release/deployment strategy, and post-deploy verification and rollback. Constraints: one developer, an MVP that should grow, EU data residency, and a desire for safe, low-ceremony delivery.

## Decision

Adopt a **GitHub Flow** branching model with **path-filtered GitHub Actions** workflows that lint, type-check, test, scan, build, and deploy each app independently, promoting through **staging → production** with a **manual approval gate** and a **blue-green** release on Container Apps. Summary by stage:

| Stage | Decision |
|-------|----------|
| Branching & triggers | **GitHub Flow**: `main` + short-lived feature branches via PR. PR → checks only; merge to `main` → deploy **staging**; production via **manual approval** (GitHub Environment). |
| Tests & coverage | **Tiered**: on PR run lint, type-check, unit + application + frontend-unit + **integration** (testcontainers; hosted runners include Docker), with an **80% coverage gate** (domain/application near 100%) before the image builds. **Playwright E2E** runs post-deploy on **staging** as the promotion gate. |
| Security & supply chain | **Dependency audit** (pip-audit, npm audit, Dependabot) + **secret scanning** (gitleaks + push protection) + **container image scan** (Trivy) + **SAST** (CodeQL). **Block on high/critical** only. SBOM/provenance deferred. |
| Image build & tagging | **Multi-stage Dockerfiles**; tag every image with the **immutable git SHA** (plus a **semver** tag on production releases); deploy by **digest**. ACR retention/cleanup policy for old images. |
| CI → Azure auth | **OIDC federated credentials** — no cloud secrets stored in GitHub; short-lived tokens scoped per repo/branch/environment. |
| Runtime secrets | **Key Vault references via managed identity** — each Container App reads secrets directly from Key Vault using its Azure identity; values never pass through CI. |
| Migrations | **Dedicated pipeline job before traffic shift** running `alembic upgrade head`, rehearsed on staging; **expand/contract** (backward-compatible) schema changes with **roll-forward** (no down-migrations). |
| Deployment strategy | **Blue-green** via Container Apps revision traffic weights: deploy "green" at 0%, verify, shift 100%; rollback = revert traffic to warm "blue". **Canary is phase 2.** |
| Post-deploy verification | Production flip gated by **health/readiness probe + smoke tests** against green at 0% (full E2E already ran on staging). |
| Rollback | **Automated rollback** on health/error-rate/latency thresholds, reverting traffic to blue; thresholds start conservative and fall back to manual alert-driven revert until metric baselines exist. |
| Pipeline hygiene | Dependency + Docker layer caching; **concurrency** cancellation of superseded runs; failure/deploy notifications (GitHub + email, extensible to a chat tool). |

## Options Considered (key decisions)

### Branching model
- **GitHub Flow (chosen):** one deployable `main`, short-lived branches, PR checks. Minimal ceremony, always-deployable `main`, scales with team size. The PR is where the coverage gate and scans enforce quality.
- **Git Flow:** `main`+`develop`+`release/*`+`hotfix/*`. Built for scheduled multi-team releases; unnecessary branch overhead for one developer.
- **Direct-to-main:** fastest, but discards the PR gate that makes TDD/scans enforceable.

### Deployment strategy
| Option | Assessment |
|--------|------------|
| **Blue-green (chosen)** | Deploy green at 0%, verify, flip 100%; instant rollback to warm blue. Near-free via Container Apps traffic weights; pairs with expand/contract migrations and the manual approval gate. |
| Canary | Gradual-% real traffic with metric-based advance/rollback. Higher value under real load, but needs traffic volume + automated metric analysis not present at launch → **phase 2**. |
| Rolling | Simplest; new revision replaces old. No warm standby, so rollback is a cold redeploy. |

### Migrations
- **Dedicated job + expand/contract + roll-forward (chosen):** ordered, visible, rehearsed on staging; backward-compatible changes keep the previous revision working, enabling zero-downtime blue-green and safe rollback without DB downgrades.
- **On startup:** simple but races across replicas and crash-loops on failure.
- **Down-migrations:** reversing schema is often lossy and hard under load.

### CI → Azure authentication
- **OIDC federated credentials (chosen):** GitHub presents a signed, short-lived token whose claims (repo/branch/environment) Azure verifies against a federated credential; no stored secret. Scoped so only the protected `production` environment can assume the prod identity.
- **Stored service-principal secret:** a durable credential in GitHub to rotate and protect; avoidable.

## Trade-off Analysis

The pipeline optimizes for **fast, safe delivery by one developer** while staying ready to scale. Tiering tests keeps PR feedback quick while still proving DB integration early and critical flows on staging before prod. Blocking scans only on high/critical avoids noise while stopping real risk. Immutable SHA tags + blue-green + expand/contract together make rollback trivial and safe — the single most important property for a solo operator. OIDC and managed-identity secrets remove every long-lived credential from CI. The main accepted cost is upfront setup (federated identity, blue-green wiring, scan integration) and the discipline of expand/contract migrations; canary and automated-rollback tuning are deferred until traffic and metrics justify them.

## Consequences

- **Easier:** Traceable, reproducible deploys; instant, safe rollback; no secrets in CI; quality enforced at the PR; independent backend/frontend delivery.
- **Harder:** More initial pipeline setup; expand/contract requires multi-step schema changes; automated rollback needs tuned thresholds (starts conservative, falls back to manual).
- **Revisit when:** traffic and observability mature → adopt **canary** with automated metric analysis; consider SBOM/provenance for stronger supply-chain assurance.

## Action Items
1. [ ] Add `deploy-backend.yml` / `deploy-frontend.yml` (path-filtered): lint → type-check → test (+integration) → coverage gate → scans → build (SHA tag) → push ACR → deploy staging → E2E → manual approval → blue-green flip to prod.
2. [ ] Configure GitHub Environments (`staging`, `production`) with required reviewer and branch/tag restrictions on prod.
3. [ ] Set up OIDC federated credentials (Entra ID app + federated credential scoped to repo/environment).
4. [ ] Grant each Container App a managed identity with Key Vault get-secret; wire Key Vault references.
5. [ ] Implement the migration job (expand/contract; alembic upgrade before traffic shift).
6. [ ] Implement blue-green via revision traffic weights; add health/readiness probes + smoke tests; define rollback thresholds (conservative initially).
7. [ ] Enable Dependabot, gitleaks/push protection, Trivy, CodeQL; gate on high/critical.
8. [ ] Add caching + concurrency cancellation; configure failure/deploy notifications.
