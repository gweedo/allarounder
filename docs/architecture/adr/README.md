# Architecture Decision Records — Allarounder

This directory records the significant architectural decisions for the Allarounder podcast blog. Each ADR captures the context, the options considered, the trade-offs, and the consequences of one decision.

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-backend-framework-fastapi.md) | Backend framework: FastAPI | 📦 Superseded by 0018 | 2026-06-14 |
| [0002](0002-decoupled-frontend-nextjs.md) | Decoupled frontend: Next.js | 📦 Superseded by 0018 | 2026-06-14 |
| [0003](0003-content-management-custom-admin.md) | Content management: custom admin UI | 📦 Superseded by 0018 | 2026-06-14 |
| [0004](0004-compute-azure-container-apps.md) | Compute: Azure Container Apps | 📦 Superseded by 0018 | 2026-06-14 |
| [0005](0005-database-azure-postgresql.md) | Database: Azure Database for PostgreSQL | 📦 Superseded by 0018 | 2026-06-14 |
| [0006](0006-monorepo.md) | Repository layout: monorepo | Accepted | 2026-06-14 |
| [0007](0007-domain-strategy.md) | Domain strategy: `.it` canonical, `.eu` redirect | Accepted | 2026-06-14 |
| [0008](0008-domain-driven-design.md) | Architecture approach: Domain-Driven Design (pragmatic) | Accepted | 2026-06-14 |
| [0009](0009-test-driven-development.md) | Development methodology: Test-Driven Development | Accepted | 2026-06-14 |
| [0010](0010-logging-observability.md) | Logging & observability | 📦 Superseded by 0018 | 2026-06-14 |
| [0011](0011-author-user-separation.md) | Author and User as separate entities (optional 1:1 link) | Accepted | 2026-06-14 |
| [0012](0012-cicd-pipeline-and-deployment-strategy.md) | CI/CD pipeline & deployment strategy | 🔄 Amended by 0018 (a new pipeline for the static build is Task 3/4 work, not yet its own ADR) | 2026-06-14 |
| [0013](0013-security-architecture.md) | Security architecture | 📦 Superseded by 0018 | 2026-06-18 |
| [0014](0014-github-branch-protection.md) | GitHub branch protection for `main` | Accepted | 2026-06-21 |
| [0015](0015-front-door-standard-tier.md) | Front Door Standard tier (drop managed WAF rule set) — amends 0013 §11 | 📦 Superseded by 0018 | 2026-06-25 |
| [0016](0016-front-door-optional-per-environment.md) | Front Door optional per-environment; disabled on staging — amends 0015 item 4 | 📦 Superseded by 0018 | 2026-07-01 |
| [0017](0017-google-sso-and-session-persistence.md) | Google SSO and session persistence for admin login — amends 0013 §1 | 📦 Superseded by 0018 | 2026-07-07 |
| [0018](0018-drive-cms-static-site.md) | Google Drive as CMS, static site on Cloudflare Pages — supersedes 0001, 0002, 0003, 0004, 0005, 0010, 0013, 0015, 0016, 0017 | Accepted | 2026-08-26 |

## Conventions

- One decision per file, numbered sequentially: `NNNN-short-title.md`.
- Status: **Proposed** → **Accepted** → **Deprecated** / **Superseded**.
- When a decision changes, write a new ADR that supersedes the old one rather than editing history.
- These ADRs are the source of truth for *why* the architecture is the way it is; the live summary lives in `../../DECISIONS.md`.
