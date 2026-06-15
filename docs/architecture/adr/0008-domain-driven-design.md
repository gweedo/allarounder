# ADR-0008: Architecture approach — Domain-Driven Design (pragmatic)

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The backend is FastAPI (ADR-0001) with a custom-built editorial workflow (ADR-0003). While much of the site is CRUD, there is genuine domain logic: the publishing lifecycle (draft → scheduled → published), slug generation and uniqueness, SEO invariants, and Spotify-link validation. The team wants a structure that keeps this logic clean, testable (see ADR-0009), and able to grow as the product becomes larger and more complex — without drowning an MVP in ceremony.

## Decision

Adopt **Domain-Driven Design, applied pragmatically**:

- **Tactical DDD** patterns inside a **single core bounded context: Content/Publishing** for v1.
- **Supporting contexts** — Identity (auth) and Newsletter — kept minimal and split into their own contexts only when complexity justifies it.
- **Layered architecture** per context with a strict dependency rule pointing inward:

```
domain/          # entities, value objects, aggregates, repository INTERFACES,
                 # domain services, domain errors — no framework imports
application/      # use cases (commands/queries), DTOs, orchestration
infrastructure/  # SQLAlchemy repository implementations, Blob storage, Key Vault
interfaces/      # FastAPI routers (thin: translate HTTP <-> application)
```

- **Tactical building blocks (initial):**
  - Aggregate root: **Article** (guards its own invariants and lifecycle transitions).
  - Value objects: `Slug`, `SpotifyUrl`, `Seo` (meta title/description/og), `PublicationStatus`.
  - Repository pattern: interfaces in `domain/`, implementations in `infrastructure/`.
  - Domain service for publishing/scheduling rules.

## Options Considered

### Option A: Pragmatic, single-context tactical DDD (chosen)
**Pros:** Clean, testable domain; isolates business rules from FastAPI/SQLAlchemy; room to grow into more contexts; fast domain unit tests support TDD.
**Cons:** More layers/indirection than plain CRUD; some mapping between domain objects and ORM models.

### Option B: Full strategic DDD from day one
**Pros:** Maximum rigor; explicit multiple bounded contexts and domain events up front.
**Cons:** Significant ceremony for a mostly CRUD content site at MVP; slows delivery; over-models a small domain.

### Option C: No DDD — straight CRUD (models + routers)
**Pros:** Fastest to write; least code.
**Cons:** Business rules leak into routers/ORM; harder to test in isolation; degrades as complexity grows.

## Trade-off Analysis

Straight CRUD is fastest but lets logic sprawl across the framework, which hurts testability and longevity — counter to the team's "scale-later" goal and the TDD decision. Full strategic DDD is the opposite extreme: more structure than this domain warrants today. Pragmatic tactical DDD in one context captures the real rules cleanly and keeps the door open to split contexts later, at the cost of some upfront layering.

## Consequences

- **Easier:** Unit-testing business rules without a database; swapping infrastructure (e.g. repository implementations); reasoning about the publishing lifecycle in one place.
- **Harder:** More boilerplate and domain↔ORM mapping; team must respect the dependency rule (domain stays framework-free).
- **Revisit if:** A new area (e.g. analytics, multi-author workflows) grows enough to deserve its own bounded context.

## Action Items
1. [ ] Lay out `src/backend/` with `domain/application/infrastructure/interfaces` layers.
2. [ ] Implement the `Article` aggregate and value objects with unit tests first (ADR-0009).
3. [ ] Define repository interfaces in `domain/`, SQLAlchemy implementations in `infrastructure/`.
4. [ ] Keep FastAPI routers thin — orchestration lives in `application/`.
