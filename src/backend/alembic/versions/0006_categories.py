"""content: categories table + category_id on articles

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-20 00:00:00.000000

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEED_CATEGORIES = [
    (
        str(uuid.uuid4()), "Interviste", "interviste",
        "Conversazioni con atleti, allenatori ed esperti del mondo sportivo.",
    ),
    (
        str(uuid.uuid4()), "Analisi", "analisi",
        "Approfondimenti tattici e tecnici sullo sport moderno.",
    ),
    (
        str(uuid.uuid4()), "Roundtable", "roundtable",
        "Discussioni a più voci sui temi caldi dello sport.",
    ),
    (
        str(uuid.uuid4()), "Out of the Box", "out-of-the-box",
        "Storie insolite e punti di vista originali sul mondo sportivo.",
    ),
]


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text, nullable=True),
    )
    categories_table = sa.table(
        "categories",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("description", sa.String),
    )
    op.bulk_insert(
        categories_table,
        [
            {"id": cat_id, "name": name, "slug": slug, "description": description}
            for cat_id, name, slug, description in _SEED_CATEGORIES
        ],
    )
    op.add_column(
        "articles",
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("articles", "category_id")
    op.drop_table("categories")
