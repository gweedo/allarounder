# ADR-0013: Security architecture

**Status:** Accepted
**Date:** 2026-06-18
**Deciders:** Team (Guido, lead developer)

## Context

The system serves a public Italian blog and a private admin UI used by three non-technical writers. The admin UI is the primary attack surface: it authenticates users, accepts file uploads, and publishes Markdown content rendered as HTML. No existing ADR covers the security posture end-to-end — the tech spec mentions auth, rate limiting, and secrets in passing but leaves implementation decisions unresolved.

Forces at play: a small team (one developer, three editors, one admin), EU data-residency and GDPR obligations, an Azure-native stack (Front Door + Container Apps + Key Vault + Blob Storage), and a DDD architecture where the `domain` layer must remain framework-free (ADR-0008).

## Decision

Adopt the following security posture across all layers of the stack.

### 1. Authentication — JWT in httpOnly cookies

Use **OAuth2 password flow + JWT**, with tokens stored exclusively in **`httpOnly`, `Secure`, `SameSite=Strict` cookies** set by the FastAPI backend. JavaScript on the page never reads the raw token value, making it immune to XSS-based token exfiltration.

Two cookies per session:
- **Access token** — 30-minute lifetime; carried on every authenticated API request.
- **Refresh token** — 14-day lifetime; single-use, rotated on every exchange; stored in a separate `httpOnly` cookie. Backed by a `refresh_tokens` table in PostgreSQL (columns: `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`). Revoked on logout, password change, or by an admin for any user.

On logout: both cookies are cleared server-side and the refresh token row is marked revoked.

### 2. Password policy

Enforced in the `identity/` context as a domain rule, not only in the UI:

- Minimum **12 characters**; no maximum below 64.
- Rejected if the SHA-1 prefix appears in the **HaveIBeenPwned k-anonymity API** (only the first 5 hex chars of the hash are sent; the full password never leaves the server).
- **Soft account lockout** after 10 consecutive failures: 5-minute cooldown, reset on successful login. Admin can hard-unlock any account via the admin panel.
- No forced periodic rotation (per NIST SP 800-63B); rotate only on confirmed or suspected compromise.
- Passwords hashed with **argon2** (primary) or bcrypt (fallback).

### 3. Role-based authorization

Two roles on `User`: `admin` and `editor`. Boundaries are enforced as FastAPI dependencies (`Depends(require_admin)`, `Depends(require_editor_owns_resource)`) on each route, not as a flag check inside handlers.

| Action | `editor` | `admin` |
|---|---|---|
| Create / edit / publish own articles | ✅ | ✅ |
| Edit / unpublish other editors' articles | ❌ | ✅ |
| Delete any article | ❌ | ✅ |
| Manage categories, tags, guests | ✅ | ✅ |
| Manage authors | ❌ | ✅ |
| Create / deactivate user accounts | ❌ | ✅ |
| Access media library (all uploads) | ✅ | ✅ |
| Delete uploaded images | ❌ | ✅ |

The principle: editors own their own content; only admins can touch other people's content, accounts, or destructive operations.

### 4. Admin route protection (Next.js)

All `/admin/*` routes are protected by **Next.js Middleware** (`middleware.ts` at the project root) running on the Edge before any page renders. The middleware:

- Matches only `/admin/:path*` (allowlist, not denylist).
- Reads the access-token cookie and verifies its signature and expiry using **`jose`** (Web Crypto API compatible — required for the Edge Runtime).
- On failure: `307` redirect to `/admin/login`.

No admin page ever renders for an unauthenticated request.

### 5. CORS policy

FastAPI's `CORSMiddleware` is configured with an **explicit origin allowlist**:

- `https://allarounder.it`
- `https://<staging-domain>` (parameterised via environment config)

`allow_credentials=True`; wildcard origins are never used. The public read API is called server-side by Next.js (SSR/ISR) and requires no CORS configuration.

### 6. Rate limiting — two-layer

**Layer 1 — WAF (Azure Front Door):** a custom rate-limit rule blocks **1,000 requests/minute per IP** across all paths. This handles volumetric attacks before traffic reaches the application.

**Layer 2 — Application (`slowapi` in FastAPI):** per-endpoint limits:

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 req/min per IP |
| `POST /auth/refresh` | 20 req/min per IP |
| `GET /search` | 60 req/min per IP |
| `POST /media/upload` | 10 req/min per user |

Exceeding a limit returns HTTP 429. The login limit works in conjunction with the 10-failure account lockout (§2).

### 7. Image upload security

All upload handling is in the `infrastructure/` layer:

- **Magic-bytes validation** using `python-magic` — only `image/jpeg`, `image/png`, `image/webp`, and `image/gif` are accepted. SVG is explicitly rejected (XML + potential embedded `<script>`).
- **10 MB size limit** enforced in FastAPI before streaming to Blob Storage.
- **Explicit `Content-Type`** set on the Blob write (`image/jpeg`, etc.) — the client-supplied header is never trusted.
- Blob URLs stored on Article records always point through Front Door (`cdn.allarounder.it/images/...`), never to raw `blob.core.windows.net` URLs.

### 8. Markdown rendering (XSS prevention)

Article bodies are stored as Markdown (plain text) and rendered in Next.js using:

```
remark → remark-gfm → remark-rehype (allowDangerousHtml: false) → rehype-sanitize → rehype-stringify
```

- `allowDangerousHtml: false` on `remark-rehype` drops any raw HTML before it enters the HTML pipeline.
- `rehype-sanitize` with the default GitHub schema strips `<script>`, `<iframe>`, `on*` attributes, and `javascript:` hrefs as a second defence.

Writers cannot embed raw HTML in article bodies. The admin UI's Markdown toolbar covers all formatting needs; raw HTML is not a supported feature.

### 9. HTTP security headers

Set in `next.config.js` headers block (applies to every route):

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | disable camera, microphone, geolocation |

`Strict-Transport-Security` (HSTS) is set at **Azure Front Door** (max-age ≥ 1 year, `includeSubDomains`).

**Content-Security-Policy** is deferred to a post-launch hardening pass — it requires auditing every third-party script loaded and getting it wrong breaks the site silently. It is a named post-v1 security action, not skipped permanently.

### 10. Blob Storage access

The Azure Blob Storage container holding images is **private**. Azure Front Door is the sole authorized public origin (via origin-access configuration). Raw `blob.core.windows.net` URLs are never exposed to clients or stored on records.

### 11. WAF rules (Azure Front Door)

Provisioned in Bicep, applied identically to staging and production:

- **Managed rule set:** `Microsoft_DefaultRuleSet_2.1` (or latest at provision time) — covers OWASP Top 10 (SQLi, XSS, remote code execution, protocol attacks).
- **Initial mode: Detection** (log only) for the first 2–4 weeks post-launch to identify false positives.
- **Switch to Prevention mode** once baseline traffic confirms no legitimate requests are being flagged.
- Custom rate-limit rule (§6 Layer 1) runs in Prevention mode from day one.

### 12. Secrets — managed identity, minimal Key Vault surface

- **PostgreSQL:** the Container App connects via **Microsoft Entra authentication (managed identity)**. No database password exists; no connection-string secret in Key Vault.
- **Blob Storage:** the backend accesses Blob via **managed identity** (`DefaultAzureCredential`). No storage account key in Key Vault.
- **Key Vault holds only the JWT signing key.** Rotation procedure: update the Key Vault secret → redeploy Container Apps → all editors re-authenticate. Rotate on confirmed compromise or annually.
- CI authenticates to Azure via **OIDC federated credentials** (ADR-0012) — no long-lived secrets in GitHub.

## Options Considered

The main alternatives were per-decision rather than a single competing posture. Key forks:

- **`localStorage` for JWT** — rejected; any XSS exfiltrates the token permanently. `httpOnly` cookie immune to this.
- **SAS tokens for Blob image serving** — rejected; tokens expire and appear in logs/referrer headers. Managed-identity + Front Door is cleaner.
- **CSP at launch** — deferred, not skipped; the risk of a misconfigured CSP silently breaking the public site is higher than the marginal benefit at launch for a site with minimal third-party scripts.
- **Audit logging in v1** — deferred to phase 2; the small team and low write volume makes this acceptable short-term.

## Trade-off Analysis

The chosen posture errs toward defence-in-depth at the cost of some setup complexity (magic-bytes validation, `jose` in Edge middleware, managed-identity Postgres). For a one-developer team this is justified: the admin UI is the highest-value target (it can publish content to a public site), and the team is non-technical (phishing/weak-password risk is real). The managed-identity approach for Postgres and Blob eliminates the largest class of credential-leak incidents at the cost of a slightly more complex Bicep template.

## Consequences

- **Easier:** no DB or storage passwords to rotate or accidentally leak; XSS cannot steal admin tokens; Markdown rendering is safe by construction; WAF handles volumetric abuse before the app sees it.
- **Harder:** refresh-token rotation requires a `refresh_tokens` table and revocation logic; `jose` must be used (not `jsonwebtoken`) in Next.js middleware due to Edge Runtime constraints; WAF rule tuning requires a burn-in period.
- **Revisit if:** CSP audit is completed post-launch (enable CSP); audit logging becomes necessary before phase 2 (add `audit_log` table); team grows and role granularity needs expanding.

## Action Items

1. [ ] Implement `refresh_tokens` table via Alembic; add rotation, revocation, and logout logic in the `identity/` context.
2. [ ] Configure `CORSMiddleware` in FastAPI with the explicit origin allowlist (env-var driven for staging/prod).
3. [ ] Add `slowapi` rate limiting to login, refresh, search, and upload endpoints.
4. [ ] Implement magic-bytes validation (`python-magic`) and 10 MB size limit on the upload endpoint.
5. [ ] Configure the Next.js rendering pipeline with `remark-rehype` (no raw HTML) + `rehype-sanitize`.
6. [ ] Add five security headers to `next.config.js`; configure HSTS at Front Door.
7. [ ] Write `middleware.ts` with `/admin/:path*` matcher and `jose` token verification; redirect to `/admin/login`.
8. [ ] Configure Blob Storage container as private; set Front Door as sole origin; store only `cdn.allarounder.it/...` URLs on records.
9. [ ] Provision WAF `Microsoft_DefaultRuleSet_2.1` in Detection mode via Bicep; add volumetric rate-limit rule.
10. [ ] Configure Entra authentication for Postgres and managed-identity access for Blob in Bicep; remove DB and storage secrets from Key Vault.
11. [ ] Document JWT signing-key rotation runbook in `docs/`.
12. [ ] Add CSP audit as a named post-launch hardening task.
13. [ ] Add audit logging (`audit_log` table, append-only) to the phase 2 backlog.
