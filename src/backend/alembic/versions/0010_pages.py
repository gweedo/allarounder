"""content: static_pages table with seed data

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-20 00:00:00.000000

"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = datetime(2026, 6, 20, 0, 0, 0, tzinfo=UTC)

_SEED = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
        "title": "Chi siamo",
        "slug": "chi-siamo",
        "body": "## Chi siamo\n\nAllarounder è la voce italiana sulla ginnastica artistica.",
        "meta_title": "Chi siamo — Allarounder",
        "meta_description": "Scopri chi siamo e la nostra missione.",
        "updated_at": _NOW,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "title": "Contatti",
        "slug": "contatti",
        "body": "## Contatti\n\nScrivici all'indirizzo: info@allarounder.it",
        "meta_title": "Contatti — Allarounder",
        "meta_description": "Contattaci per informazioni o collaborazioni.",
        "updated_at": _NOW,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000003"),
        "title": "Privacy Policy",
        "slug": "privacy-policy",
        "body": "## Privacy Policy\n\nInformativa sul trattamento dei dati personali.",
        "meta_title": "Privacy Policy — Allarounder",
        "meta_description": "Leggi la nostra informativa sulla privacy.",
        "updated_at": _NOW,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
        "title": "Cookie Policy",
        "slug": "cookie-policy",
        "body": "## Cookie Policy\n\nInformativa sull'uso dei cookie.",
        "meta_title": "Cookie Policy — Allarounder",
        "meta_description": "Informazioni sull'uso dei cookie su questo sito.",
        "updated_at": _NOW,
    },
]


def upgrade() -> None:
    op.create_table(
        "static_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("meta_title", sa.String(60), nullable=True),
        sa.Column("meta_description", sa.String(160), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_static_pages_slug", "static_pages", ["slug"])
    op.bulk_insert(
        sa.table(
            "static_pages",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("title", sa.String),
            sa.column("slug", sa.String),
            sa.column("body", sa.Text),
            sa.column("meta_title", sa.String),
            sa.column("meta_description", sa.String),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        _SEED,
    )


def downgrade() -> None:
    op.drop_index("ix_static_pages_slug", "static_pages")
    op.drop_table("static_pages")
