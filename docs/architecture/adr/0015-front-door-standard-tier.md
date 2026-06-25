# ADR-0015: Front Door Standard tier (drop managed WAF rule set)

**Status:** Accepted
**Date:** 2026-06-25
**Deciders:** Team (Guido, lead developer)
**Amends:** ADR-0013 §11 (WAF rules)

## Context

The edge (TLS, WAF, `.eu → .it` 301 redirect, image CDN) runs on **Azure Front Door**, provisioned in `infra/modules/frontdoor.bicep`. The profile and its WAF policy were originally created on the **Premium** tier (`Premium_AzureFrontDoor`).

The only reason the deployment required Premium was the **Microsoft-managed Default Rule Set** (`Microsoft_DefaultRuleSet_2.1`) called for by ADR-0013 §11. Per Microsoft's own tier documentation, *"the Microsoft-managed rule set isn't available for the Azure Front Door Standard SKU"* — managed rule sets, bot-manager rules, and Private Link to origins are Premium-only. Everything else this project uses (custom rate-limit rules, HSTS, the redirect rule set, custom domains with managed TLS) is fully supported on **Standard**.

The cost gap is large and fixed, independent of traffic:

| Tier | Base fee | What it buys |
|---|---|---|
| **Standard** | **~$35/month** | Custom WAF rules, routing rules, caching, managed TLS, HSTS, redirects |
| **Premium** | **~$330/month** | All of Standard **plus** Microsoft-managed rule sets, bot protection, Private Link origins |

(Source: [Compare pricing between Azure Front Door tiers](https://learn.microsoft.com/azure/frontdoor/understanding-pricing#cost-assessment).)

Two facts make the Premium spend hard to justify for this project:

1. The managed rule set was configured in **Log/Detection mode** (`ruleSetAction: 'Log'`), so it was paying the Premium premium without actively blocking anything. ADR-0013 §11 *planned* to flip it to Prevention after a 2–4 week burn-in — so the spend was buying a **planned future** capability, not a control in force today.
2. The only **active** blocking control at the edge is the **custom per-IP rate-limit rule** (1,000 req/min), which is a *custom* rule and is fully supported on Standard.

For a single-developer Italian content blog whose origins are public Container Apps and whose images are served via User Delegation SAS (not Private Link), ~$295/month (~$3,500/year, doubled across staging + production) for managed WAF detection-only rules is poor value.

## Decision

**Move the Front Door profile and its WAF policy from `Premium_AzureFrontDoor` to `Standard_AzureFrontDoor`**, and **remove the Microsoft-managed rule set**. Concretely, in `infra/modules/frontdoor.bicep`:

- `sku.name` → `Standard_AzureFrontDoor` on **both** the `Microsoft.Cdn/profiles` profile and the `FrontDoorWebApplicationFirewallPolicies` policy (the two must match).
- **Delete** the `managedRules` / `managedRuleSets` block. A `managedRules` block is rejected on a Standard-tier policy, so this is required for the deployment to validate, not optional.
- **Keep** the WAF policy in `mode: 'Prevention'` with `requestBodyCheck: 'Enabled'` and the **custom `RateLimitPerIp` rule (Block)** exactly as-is — all Standard-supported and still the active edge control.

This **amends ADR-0013 §11**: the managed `Microsoft_DefaultRuleSet_2.1` and its Detection→Prevention burn-in plan are withdrawn. The Layer-1 volumetric rate limit in ADR-0013 §6 is unchanged. ADR-0013 §9 (HSTS at Front Door) and §10 (private Blob, Front Door as origin) are functionally unaffected — neither depends on the Premium tier.

## Options Considered

- **Stay on Premium and flip managed rules to Prevention.** Justified only if managed OWASP/bot protection is a hard requirement. For this product the app-layer controls already cover the relevant classes (below), so this is ~$295/month for marginal defence-in-depth.
- **Standard + managed rules.** Not possible — managed rule sets are not offered on Standard.
- **Standard, keep custom rate limit, drop managed rules (chosen).** Retains the only active edge control, keeps TLS/HSTS/redirect/CDN, and removes the cost driver.

## Trade-off Analysis

What is given up is **defence-in-depth at the edge**, not a primary control. The managed rule set was a generic OWASP/Threat-Intelligence layer that was logging-only and never reached enforcement. The primary protections against the attack classes it targets live at the application layer and are **unchanged by this ADR**:

- **SQL injection** — SQLAlchemy parameterized queries; no raw SQL string-building (ADR-0008 infrastructure layer).
- **XSS** — Markdown rendered with `remark-rehype` (no raw HTML) → `rehype-sanitize`; raw HTML in bodies unsupported (ADR-0013 §8).
- **Malicious uploads** — magic-bytes allowlist, SVG rejected, 10 MB cap, server-set `Content-Type` (ADR-0013 §7).
- **Input validation** — Pydantic schemas at the API boundary.
- **Volumetric abuse** — the custom per-IP rate-limit rule (edge) plus `slowapi` per-endpoint limits (app) — both retained (ADR-0013 §6).

**Private Link to origins** (also Premium-only) is forgone, but the current design never used it: the image container is private (`allowBlobPublicAccess: false`) and access is granted through **User Delegation SAS** issued by the backend's managed identity, not via a Front Door Private Link origin. So there is no functional change to Blob access.

## Consequences

- **Easier / cheaper:** Front Door base fee drops from ~$330 to ~$35/month per environment (~$295/month, ~$3,500/year saved per environment; roughly double across staging + production).
- **Lost:** Microsoft-managed OWASP/bot-manager rule sets at the edge, and the option of Private Link origins. Edge WAF is now custom-rules-only.
- **Unchanged:** TLS, HSTS, `.eu → .it` 301 redirect, image CDN/caching, custom domains with managed certificates, and the per-IP volumetric rate limit.
- **Revisit if:** WAF/edge logs show real application-layer attack traffic that the app controls don't catch; bot abuse becomes material; or a compliance/customer requirement mandates a managed WAF rule set. Re-upgrading is a one-line SKU revert on both resources plus re-adding the `managedRules` block — Standard → Premium is a non-breaking upgrade.

## Action Items

1. [x] Set `sku.name = Standard_AzureFrontDoor` on the Front Door profile and WAF policy in `infra/modules/frontdoor.bicep`.
2. [x] Remove the `managedRules` block from the WAF policy.
3. [x] Update `docs/DECISIONS.md` WAF entry and add a "superseded in part" pointer to ADR-0013 §11.
4. [ ] On next deploy, confirm the Standard profile provisions cleanly and the `RateLimitPerIp` rule is active in Prevention mode (staging first, then production).
5. [ ] Add a named post-launch task to review edge WAF logs and re-evaluate the Premium upgrade if attack traffic warrants it.
