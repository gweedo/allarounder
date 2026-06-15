# ADR-0009: Development methodology — Test-Driven Development

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The system has a custom backend (ADR-0001), a custom admin UI (ADR-0003), and a DDD structure (ADR-0008) with real domain rules. With one developer and an intent to grow the product over time, we need confidence that changes don't break existing behavior and that the design stays clean. TDD pairs naturally with DDD: a framework-free domain layer is fast and trivial to unit-test.

## Decision

Develop using **Test-Driven Development** (red → green → refactor) with a **test pyramid**:

| Layer | Scope | Tools |
|-------|-------|-------|
| Domain unit | Aggregates, value objects, domain services — no I/O | pytest |
| Application | Use cases against **fake/in-memory repositories** | pytest |
| Integration | Repository impls against **real PostgreSQL** | pytest + **testcontainers** |
| API / contract | HTTP endpoints, request/response, auth | httpx / schemathesis (OpenAPI) |
| Frontend unit | Components, hooks | Vitest + React Testing Library |
| E2E | Critical user/editor flows | Playwright |

- **Most tests at the bottom** (fast domain/application tests); fewer, slower integration/e2e tests at the top.
- **Tests live with the code** they cover; written **before** the implementation.
- **CI gate:** the GitHub Actions pipelines run the test suite (with a coverage threshold) **before** building/pushing images (ties into ADR-0004/0006 CI/CD).

## Options Considered

### Option A: TDD with pytest + testcontainers (chosen)
**Pros:** High confidence; drives clean, decoupled design; realistic integration coverage against real Postgres; regressions caught in CI.
**Cons:** Slower initial authoring; testcontainers need Docker in CI and add some runtime.

### Option B: Tests after implementation (test-last)
**Pros:** Faster to first running feature.
**Cons:** Tests tend to be thinner and design-after-the-fact; less design pressure; easier to skip under deadline.

### Option C: pytest with mocks only (no containers)
**Pros:** Fast CI, no Docker dependency for tests.
**Cons:** Mocked DB hides real query/migration/constraint bugs; weaker integration confidence.

## Trade-off Analysis

Test-last and mock-only are cheaper short-term but trade away exactly the confidence this project wants as it scales. Real-Postgres integration via testcontainers costs some CI time and a Docker dependency but catches schema, query, and constraint issues that mocks miss. TDD's upfront cost is repaid by the design pressure it puts on the DDD layers and by safer change over the product's life.

## Consequences

- **Easier:** Refactoring safely; verifying domain rules in isolation; catching DB-level issues before deploy; living documentation via tests.
- **Harder:** Slower feature start; CI needs Docker for testcontainers and runs longer; discipline required to keep writing tests first.
- **Revisit if:** CI time becomes painful — tier integration tests (e.g. run on PR/main only) while keeping unit tests on every push.

## Action Items
1. [ ] Set up pytest, coverage, and a fake-repository test harness in `src/backend/`.
2. [ ] Add testcontainers-based integration tests for repositories and migrations.
3. [ ] Add Vitest + React Testing Library and Playwright in `src/frontend/`.
4. [ ] Enforce the test + coverage gate in both GitHub Actions workflows before image build.
