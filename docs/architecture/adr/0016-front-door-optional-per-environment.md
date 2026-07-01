# ADR-0016: Front Door optional per-environment; disabled on staging

**Status:** Accepted
**Date:** 2026-07-01
**Deciders:** Team (Guido, lead developer)
**Amends:** ADR-0015 Action Item 4; supersedes the Front-Door-verification clause of the "Environments: separate staging + production" decision in `docs/DECISIONS.md`

## Context

The v1 infra cost-optimization pass (issue #71, following `retrospective-infra-cost-overprovisioning-2026-06-25.md` action item #4) reviewed the live Azure footprint for MVP-appropriate sizing. Azure Front Door Standard carries a flat ~$35/month base fee **per environment**, independent of traffic (ADR-0015).

Front Door's jobs are: managed TLS + the custom domain, the `.eu → .it` 301 redirect, the image CDN route, and the custom per-IP rate-limit WAF rule. All four are **production-facing concerns** — they exist because `allarounder.it`/`allarounder.eu` are public, indexed, real-traffic domains. Staging has no custom domain, no public SEO surface, and no need for the `.eu` redirect. Its frontend Container App is already externally reachable over HTTPS on its own `*.azurecontainerapps.io` FQDN with Azure-managed TLS (`infra/modules/container-apps.bicep`, frontend `ingress.external: true`), so removing Front Door from staging does not remove staging's ability to serve HTTP(S) traffic for manual QA or E2E runs.

## Decision

Add an `enableFrontDoor` boolean parameter to `infra/main.bicep` (default `true`) and conditionally deploy the `frontdoor` module on it (`if (enableFrontDoor)`). Set `enableFrontDoor = false` in `infra/parameters/staging.bicepparam` and `enableFrontDoor = true` in `infra/parameters/production.bicepparam`. The `frontDoorEndpoint` output on `main.bicep` is guarded (`enableFrontDoor ? frontdoor!.outputs.frontDoorEndpointHostname : ''`) so it resolves to an empty string, not a deployment failure, when Front Door is absent.

## Options Considered

- **Keep Front Door on both environments (status quo).** Simplest, but pays ~$35/month for TLS/redirect/WAF capability staging structurally cannot exercise the way production does (no custom domain, no real traffic pattern to rate-limit against).
- **Tear down staging's Front Door manually / out-of-band.** Rejected — reintroduces exactly the kind of `az`-CLI drift-vs-Bicep problem the project has already been burned by (see `project-dockerignore-alembic-rootcause`-adjacent incidents); Bicep must stay the source of truth.
- **Gate it behind a parameter, default off on staging (chosen).** Declarative, reviewable in the parameter file, Bicep remains authoritative, and it's a one-line flip (`enableFrontDoor = true`) if staging ever needs Front Door back for a specific verification.

## Consequences

- **Cheaper:** ~$35/month saved on staging (issue #72's estimate), no functional loss for production.
- **Lost:** staging can no longer verify the Front Door redirect, managed TLS, or the `RateLimitPerIp` WAF rule pre-production. This directly changes the rationale recorded for `docs/DECISIONS.md`'s "Environments: separate staging + production" entry, which listed "Front Door redirect, TLS" as one of the things staging verifies — that clause is now inaccurate and is corrected alongside this ADR.
- **ADR-0015 Action Item 4** ("confirm the Standard profile provisions cleanly and the `RateLimitPerIp` rule is active in Prevention mode — staging first, then production") is no longer achievable as originally written, since staging will not run a Front Door profile going forward. Verification of the Standard-tier Front Door now happens directly against production (already done once, per `project-prod-promotion-pending` memory: staging's canary deploy proved the Standard-tier recreate path before this ADR existed).
- **Revisit if:** a change to `frontdoor.bicep` (WAF rule tuning, redirect logic, TLS settings) needs pre-production verification — flip `enableFrontDoor = true` on staging for that one deploy, verify, then flip back. This ADR does not remove that capability, only the default.

## Action Items

1. [x] Add `enableFrontDoor` parameter to `infra/main.bicep`; gate the `frontdoor` module.
2. [x] Set `enableFrontDoor = false` in `infra/parameters/staging.bicepparam`, `= true` in production.
3. [x] Update `docs/DECISIONS.md`'s "Environments: separate staging + production" entry to drop the now-inaccurate Front Door verification clause.
4. [x] Update `docs/architecture/INFRA-GUIDE.md` Step 10a/10b so the staging Front Door CNAME instructions aren't presented as if a staging profile exists.
5. [ ] On the next staging deploy, confirm the frontend remains reachable over HTTPS on its Container App FQDN with Front Door absent (acceptance criterion of issue #72; requires the Azure subscription to be re-enabled first — see `project-prod-promotion-pending` memory).
