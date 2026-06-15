# ADR-0005: Database: Azure Database for PostgreSQL

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The FastAPI backend (ADR-0001) needs a relational database on Azure to store articles, authors, categories, guests, pages, newsletter subscribers, and admin users (see `SITE-STRUCTURE.md`). The data model is straightforward relational content with a few many-to-many relationships.

## Decision

Use **Azure Database for PostgreSQL** (Flexible Server), accessed via SQLAlchemy + Alembic, deployed in the same EU region (Italy North).

## Options Considered

### Option A: Azure Database for PostgreSQL (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Competitive; Flexible Server tiers |
| Scalability | High |
| Team familiarity | Good |

**Pros:** First-class PostgreSQL on Azure, excellent SQLAlchemy support, JSONB for flexible fields (e.g. guest/author links), strong open-source ecosystem, easy local dev parity.
**Cons:** None material for this use case.

### Option B: Azure SQL Database
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Competitive |
| Scalability | High |
| Team familiarity | Depends on SQL Server experience |

**Pros:** Deeply integrated managed SQL Server, strong tooling.
**Cons:** SQL Server dialect; PostgreSQL is the more common, portable default in the Python ecosystem and the team has no SQL Server preference.

## Trade-off Analysis

Both are fully managed and more than capable for a content site. PostgreSQL is the conventional, portable choice with the Python/SQLAlchemy stack and offers JSONB for semi-structured fields. Azure SQL would only win given an existing SQL Server investment, which we do not have.

## Consequences

- **Easier:** Standard SQLAlchemy/Alembic workflow, JSONB flexibility, local↔cloud parity, portability.
- **Harder:** Nothing notable.
- **Revisit if:** A future requirement strongly favors SQL Server tooling.

## Action Items
1. [ ] Provision PostgreSQL Flexible Server in Italy North.
2. [ ] Store connection string in Key Vault.
3. [ ] Set up Alembic migrations; configure local Postgres for development.
