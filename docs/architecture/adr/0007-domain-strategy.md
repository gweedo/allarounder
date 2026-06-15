# ADR-0007: Domain strategy: `.it` canonical, `.eu` redirect

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team

## Context

The team owns two domains for the brand — a `.it` and a `.eu`. Content is **Italian only** and the audience is Italian. Serving the same content on both domains would split SEO equity and create duplicate-content problems. We must choose a single canonical domain and decide how to handle the other.

## Decision

Make **`allarounder.it` the canonical (primary) domain**. **`allarounder.eu` 301-redirects** to the matching `.it` path. The redirect is handled at the edge with **Azure Front Door**; TLS certificates are provisioned for both domains; every page sets `<link rel="canonical">` to its `.it` URL.

## Options Considered

### Option A: `.it` canonical, `.eu` → `.it` 301 (chosen)
**Pros:** `.it` carries strong local trust for an Italian audience; consolidates all SEO equity on one domain; `.eu` is preserved and protected (no squatting) while funneling any traffic to the primary.
**Cons:** None material given Italian-only content.

### Option B: `.eu` canonical, `.it` → `.eu` 301
**Pros:** Better if targeting a broad pan-European/multilingual audience.
**Cons:** Weaker local signal for an Italian-only site; not aligned with the audience.

### Option C: Serve both (no redirect)
**Cons:** Duplicate content, split ranking signals, SEO penalty risk — rejected.

## Trade-off Analysis

Because content and audience are Italian (see the language decision in `DECISIONS.md`), `.it` is the natural canonical. A permanent (301) redirect consolidates link equity and avoids duplicate content, while keeping the `.eu` domain owned and pointing home. A `.eu`-primary choice would only make sense for a pan-European strategy we are not pursuing.

## Consequences

- **Easier:** Single, clear SEO target; both domains owned and protected; one place (Front Door) manages the redirect.
- **Harder:** Must manage TLS for both domains and keep the canonical/redirect rules correct.
- **Revisit if:** The site later goes multilingual or targets a pan-European audience.

## Action Items
1. [ ] Configure Azure Front Door with the redirect rule `*.eu/*` → `allarounder.it/*` (301).
2. [ ] Provision/managed TLS certificates for both domains.
3. [ ] Emit canonical tags to `.it` on every page.
