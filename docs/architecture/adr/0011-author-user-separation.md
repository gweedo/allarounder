# ADR-0011: Author and User as separate entities with an optional 1:1 link

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The data model needs to represent two related but distinct concepts: the **public byline** shown on an article (display name, bio, photo, social links) and the **login account** used to access the custom admin UI (email, hashed password, role). The team is three writers plus Guido, and v1 also supports **guest contributors** who may have a byline without ever logging in. We must decide how to model the relationship between "who is credited" and "who can sign in."

## Decision

Model `Author` and `User` as **separate entities** with an **optional 1:1 link**: `Author.user_id` is a nullable, unique foreign key to `User`.

- `Author` — public byline: name, slug, bio, photo, links.
- `User` — login account: email, hashed password, role (`admin`/`editor`), is_active.
- A writer's `User` maps to exactly one `Author`; an `Author` can exist with `user_id = NULL` (guest byline, no login). Articles reference `author_id` for the byline.

## Options Considered

### Option A: Separate entities, optional 1:1 link (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — two tables + a nullable link |
| Flexibility | High — supports guest authors and login-less bylines |
| Security | High — auth data isolated from public data |
| Team familiarity | Good |

**Pros:** Keeps authentication concerns out of the public byline; supports guest authors with no account; a login can auto-provision its Author profile; clean separation for the API (public byline vs admin account).
**Cons:** Two entities to keep in sync; the link must be maintained when a writer joins/leaves.

### Option B: Single `User` entity (merge byline into the account)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one table |
| Flexibility | Low — every byline needs a login |
| Security | Lower — public and auth fields mixed |
| Team familiarity | Good |

**Pros:** Simplest model; nothing to link.
**Cons:** No guest authors (every byline would need an account); public profile fields live on the auth record (exposure risk, awkward API); deactivating a login entangles the public byline.

### Option C: Fully independent, no link
**Pros:** Maximum flexibility; admin sets an article's author freely.
**Cons:** No automatic mapping from a logged-in writer to their byline; more manual bookkeeping and room for mismatch.

## Trade-off Analysis

Merging into one entity (B) is simplest but breaks the guest-author requirement and mixes authentication data with public profile data, which is both a security and an API-cleanliness concern. Fully independent (C) loses the convenient "my login knows my byline" mapping and invites mismatches. The optional 1:1 link (A) captures both needs — guest authors without accounts, and a clean automatic mapping for writers who do log in — at the modest cost of maintaining the nullable link.

## Consequences

- **Easier:** Guest bylines; isolating auth/PII from public profile data; a public authors API that exposes no account fields; auto-provisioning an Author when a writer's User is created.
- **Harder:** Keeping the link consistent (e.g. when offboarding a writer, decide whether the Author is retained as a guest-style byline); slightly more admin UI to manage both.
- **Revisit if:** Guest authors are dropped from scope (then Option B's simplicity could win), or richer per-user permissions emerge.

## Action Items
1. [ ] Model `Author` with nullable, unique `user_id` FK to `User`.
2. [ ] On creating an `editor`/`admin` User, offer to create/link an Author profile.
3. [ ] Public authors API returns Author fields only — never User/account fields.
4. [ ] Define offboarding behavior: nulling `user_id` converts an Author into a guest-style byline.
