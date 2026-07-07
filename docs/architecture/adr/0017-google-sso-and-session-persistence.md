# ADR-0017: Google SSO and session persistence for admin login

**Status:** Accepted
**Date:** 2026-07-07
**Deciders:** Guido + Claude (Milestone 7)
**Amends:** ADR-0013 §1 (Authentication — JWT in httpOnly cookies)

## Context

The three non-technical writers and the admin all already have Google accounts (Workspace or personal Gmail) and already juggle enough passwords. Password-based login (ADR-0013 §1) works but is one more credential to phish, forget, or reuse. Google Sign-In removes that friction for the people who want it, without removing the password fallback for anyone who doesn't (or for the period before the Google Cloud project exists).

Forces at play:

- The admin UI's session model is already non-trivial: short-lived access-token cookie, rotating refresh token, `persistent` flag for "Ricordami" (ADR-0013 §1, extended by the M1 session-persistence work in `docs/DECISIONS.md`). Any SSO addition has to plug into this, not duplicate it.
- `domain`/`application` stay framework-free (ADR-0008); a third-party auth library that owns its own session/cookie handling would either violate that or have to be walled off awkwardly.
- There is no user self-registration anywhere in this product — every `User` row is created by an admin (`AuthService.create_admin`). SSO must not become a backdoor around that.
- The Google Cloud project (OAuth client, consent screen) does not exist yet at the time this code is written; the feature has to be safely mergeable and deployable in a dormant state.
- Cookies are `SameSite=Strict` (ADR-0013 §1), which is deliberately hostile to cross-site requests — and an OAuth redirect flow is, by definition, a trip through a cross-site page (`accounts.google.com`).

## Decision

### 1. Backend-driven OIDC, authorization-code flow with PKCE

The FastAPI backend — not the Next.js frontend — owns the entire Google OAuth handshake. Two new endpoints:

```
GET /api/admin/auth/google/login      → 302 to Google's consent screen
GET /api/admin/auth/google/callback   → exchanges the code, logs in, 302 to /admin/login
```

The backend generates `state`, a `nonce`, and a PKCE `code_verifier`/`code_challenge` (S256) per attempt, and verifies the returned `id_token`'s signature (via Google's published JWKS), audience, issuer, expiry, and nonce itself (`app/infrastructure/identity/google.py`). No ID token or authorization code is ever visible to frontend JavaScript.

### 2. NextAuth explicitly rejected

NextAuth (Auth.js) was considered and rejected. It would manage its own session cookie and its own token refresh lifecycle in the Next.js layer — a **second, parallel session system** running alongside the existing FastAPI-issued access/refresh token pair. That either means two independent sources of truth for "is this request authenticated" (a security-relevant inconsistency risk) or plumbing NextAuth's session through to the backend anyway, at which point it has bought nothing but an extra dependency and an extra cookie. It would also bypass the refresh-token rotation and revocation machinery (`refresh_tokens` table, single-use rotation, admin-revocable) that already exists and that every other login path uses. A backend-driven flow that ends by calling the same `AuthService._issue_tokens` helper as password login keeps exactly one session system.

### 3. No open signup — Google is an authentication method, not a registration channel

`AuthService.login_with_google` only succeeds for an email that already has a `User` row (created by an admin, same as today). An unrecognized Google account is rejected with the same `InvalidCredentialsError` as a bad password — it does not create an account. This preserves the existing invariant that the admin controls who has access; Google is just a second way for an already-provisioned person to prove who they are.

### 4. Account linking: verified email on first login, then `google_sub`

- Google's `sub` claim is the durable identifier Google recommends (emails can change; `sub` doesn't). `User.google_sub` (nullable, unique) stores it.
- **First SSO login for a user:** no `google_sub` is on file yet, so the backend falls back to a case-insensitive match on `identity.email` against existing users. If found, and `identity.email_verified` is true, the account is linked (`User.link_google(sub)`) and the sub persists for every subsequent login.
- **Every login after that:** looked up directly by `google_sub` — no email dependency, so it survives the user later changing their Google account's email.
- **Unverified email** (`email_verified: false`) is rejected outright, on first login or otherwise — Google issues unverified-email identities in some edge cases (e.g. some Workspace configurations), and trusting one would let an attacker who controls a similarly-named unverified mailbox impersonate a legitimate user.
- If a `google_sub` is already linked to a *different* sub than the one just presented (should not happen in practice; would indicate a Google-side account identity change), `User.link_google` raises `GoogleAccountMismatchError` rather than silently re-linking, and the callback treats it as a login failure. Re-linking, if ever needed, is a deliberate admin action, not an automatic one.

### 5. Email/password remains as fallback

Nothing about password login (ADR-0013 §1) changes. `google_sub` is nullable; existing users are unaffected until they choose to use "Accedi con Google" for the first time. If Google is ever unreachable or a writer doesn't want to link a Google account, password login keeps working exactly as before.

### 6. `google_sso_enabled` feature flag, default off

Both new endpoints depend on a guard that 404s the moment `google_sso_enabled` is false — not 403, since when the feature is off there is nothing "forbidden," there's nothing there. A `model_validator` on `Settings` requires `google_client_id`, `google_client_secret`, and `google_redirect_uri` to all be set whenever the flag is true, so a misconfigured "half enabled" state fails fast at startup instead of failing confusingly at request time. This lets this whole milestone merge and deploy to production **before** the Google Cloud project, OAuth consent screen, and client credentials exist — the code ships dormant, and turning it on later is a config change, not a deploy.

### 7. Two `SameSite=Strict` gotchas

The existing auth cookies are `SameSite=Strict` (ADR-0013 §1) — correct for them, but it collides with an OAuth redirect flow in two specific spots, both worth calling out explicitly because they're easy to get backwards:

- **The `oauth_state` cookie must be `SameSite=Lax`, not `Strict`.** `/login` sets a short-lived (10 min), signed cookie holding `state`/`nonce`/`code_verifier` before redirecting to Google. The user's browser returns to `/callback` via a **top-level cross-site navigation** initiated by `accounts.google.com`. A `Strict` cookie is never sent on a cross-site navigation, full stop — so if this cookie were `Strict`, state verification would fail on every single attempt, not just malicious ones. `Lax` still withholds the cookie from cross-site subresource/XHR requests (the case `Strict`/`Lax` actually differ on for CSRF purposes) while allowing it on this top-level GET.
- **The post-callback redirect bounces through `/admin/login?sso=success` before reaching `/admin`.** `Set-Cookie` itself is not subject to `SameSite` — a cross-site response can still *set* a `Strict` cookie, it just won't be *sent* back on a subsequent cross-site request. So `/callback` (still part of the Google→backend redirect chain) can and does set the real `access_token`/`refresh_token` cookies. But if the callback redirected straight to `/admin`, that navigation only exists because Google sent the browser to our callback URL, which — depending on how strictly a browser scopes the redirect chain's "site" — risks the freshly-set `Strict` cookies not being sent on the very next request. Landing on `/admin/login?sso=success` first and having the **login page itself** perform a same-site client-side `router.replace("/admin")` guarantees the request that finally loads `/admin` is unambiguously same-site, so the cookies are sent.

## Options Considered

- **NextAuth / Auth.js** — rejected; see §2 above (parallel session system, bypasses refresh rotation).
- **Frontend-driven implicit/PKCE flow (Google's client-side JS SDK, token handled in the browser)** — rejected; this is exactly the "JWT visible to JavaScript" failure mode ADR-0013 §1 was written to avoid. Keeping the whole exchange server-side means the id_token and authorization code never reach the browser.
- **Allow Google sign-in to auto-provision new `User` rows** — rejected; breaks the existing invariant that only an admin creates accounts (ADR-0013 §3 role model), and would turn a stolen/guessed corporate Google account into an instant admin-UI account.
- **Ship with the feature flag always-on, gated only by unset client credentials** — rejected in favor of an explicit boolean; a missing-env-var failure mode is a worse UX (obscure 500s) than a clean 404, and an explicit flag makes "is this live" a one-line answer during rollout.

## Consequences

- **Easier:** writers can sign in with an account they already use daily; no new password to manage for them. The code is fully tested and mergeable today even though the Google Cloud project doesn't exist yet.
- **Harder:** the auth surface now has two entry points to reason about instead of one; the `SameSite` interactions above are subtle and are exactly the kind of thing a future refactor could silently break — hence documenting them here and in code comments at the point of use.
- **Unchanged:** password login, the `refresh_tokens` table/rotation/revocation model, the role system, and the "no self-signup" invariant.
- **Revisit if:** the Google Cloud project is provisioned and `google_sso_enabled` is flipped on in an environment — at that point, do a live end-to-end check of the callback flow (this ADR's automated tests use a locally generated RSA keypair and a fake OIDC client; they cannot catch a live misconfiguration such as a wrong redirect URI registered with Google).

## Action Items

1. [x] Add `User.google_sub` + `link_google` + `GoogleAccountMismatchError` (domain) and migration `0012_users_google_sub.py`.
2. [x] Add `AuthService.login_with_google` (application) against the `GoogleOidcClient` protocol.
3. [x] Implement `HttpGoogleOidcClient` (infrastructure) — PKCE authorization URL, code exchange, id_token verification against Google's JWKS.
4. [x] Add `GET /api/admin/auth/google/login` and `/callback` (interfaces), feature-flagged off by default.
5. [x] Add the "Accedi con Google" button and `?sso=` handling to the admin login page.
6. [ ] Create the actual Google Cloud project, OAuth consent screen, and Web client credentials (see "Setup" below) — blocked on nothing technical, just needs to be done once, outside of this code change.
7. [ ] Wire `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_SSO_ENABLED` into Key Vault + Container Apps via Bicep (`infra/`) — currently only wired into local `.env`; see "Setup" below.

## Setup

*(This repository has no `docs/runbooks/` directory yet, so the manual setup steps live here rather than in a separate runbook.)*

**1. Google Cloud project & OAuth consent screen**

- Create (or reuse) a Google Cloud project for Allarounder.
- Configure the OAuth consent screen as **External**, publishing status **Testing** (fine for a 4-person team) — add the admin's and the three writers' Google account emails as **test users**. Test-mode consent screens work indefinitely for listed test users without Google's app-verification review, which is unnecessary for an internal 4-person tool.
- Scopes needed: `openid`, `email` only. No Drive/Docs scopes — unrelated to this feature (that's the separate paste-based Google Docs import from `docs/DECISIONS.md`'s Milestone 6 entry).

**2. OAuth 2.0 Client ID (Web application type)**

Register these **Authorized redirect URIs** (one client, three URIs — local, staging, production):

```
http://localhost:3000/api/admin/auth/google/callback
https://<staging-domain>/api/admin/auth/google/callback
https://allarounder.it/api/admin/auth/google/callback
```

Note the redirect URI is the **frontend's** proxy path (`app/api/[...path]/route.ts` forwards it to the backend), not a direct backend URL — the backend has internal-only ingress in Azure (ADR-0004/TECH-SPEC §6), so Google can only ever reach it through the frontend's reverse proxy.

**3. Local `.env` (`src/backend/.env`)**

```
GOOGLE_CLIENT_ID=<from the Google Cloud console>
GOOGLE_CLIENT_SECRET=<from the Google Cloud console>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/admin/auth/google/callback
GOOGLE_SSO_ENABLED=true
```

**4. Staging/production infra — follow-up, not done in this change**

This repo *does* have a Bicep `infra/` tree (`infra/modules/keyvault.bicep`, `infra/modules/container-apps.bicep`, `infra/parameters/{staging,production}.bicepparam`), so wiring these four settings through Key Vault + Container App environment variables is a mechanical follow-up in that existing pattern — not a new capability to build. It is intentionally **not** done as part of this milestone: the flag defaults off, so the feature ships dormant everywhere until that Bicep change lands and someone completes step 1–2 above for the real domains.
