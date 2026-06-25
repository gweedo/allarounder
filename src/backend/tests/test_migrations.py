"""Regression test: the full Alembic migration chain must apply and reverse cleanly.

Unit/API tests mock the persistence layer and never execute migrations, so
migration bugs slip through (2026-06 deploy incident: ``sa.Enum(create_type=False)``
silently re-created enum types because ``create_type`` is only honoured by
``postgresql.ENUM``). This test runs the real chain against a Postgres instance.

Requires ``DATABASE_URL`` to point at a reachable Postgres; skipped otherwise so
local ``pytest`` runs without a database still pass. CI's test job provides one.
"""

import os

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="DATABASE_URL not set; the migration chain test needs a real Postgres",
)

EXPECTED_TABLES = {
    "users",
    "refresh_tokens",
    "articles",
    "categories",
    "tags",
    "article_tags",
    "authors",
    "guests",
    "article_guests",
    "static_pages",
}


def _alembic_config() -> Config:
    cfg = Config("alembic.ini")
    assert DATABASE_URL is not None
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    return cfg


def test_migration_chain_upgrades_and_downgrades_cleanly() -> None:
    cfg = _alembic_config()
    assert DATABASE_URL is not None
    engine = create_engine(DATABASE_URL)
    try:
        # Normalise to a clean slate regardless of prior state.
        command.downgrade(cfg, "base")

        # Full upgrade must create every expected table.
        command.upgrade(cfg, "head")
        tables = set(inspect(engine).get_table_names())
        missing = EXPECTED_TABLES - tables
        assert not missing, f"upgrade head left these tables missing: {missing}"

        # Full downgrade must reverse cleanly (exercises idempotent enum drops).
        command.downgrade(cfg, "base")
        remaining = set(inspect(engine).get_table_names()) - {"alembic_version"}
        assert not remaining, f"downgrade base left these tables behind: {remaining}"

        # Re-apply so a second upgrade succeeds (exercises idempotent enum create).
        command.upgrade(cfg, "head")
        assert EXPECTED_TABLES.issubset(set(inspect(engine).get_table_names()))
    finally:
        engine.dispose()
