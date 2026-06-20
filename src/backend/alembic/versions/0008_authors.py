"""content: authors table + author_profile_id on articles

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "authors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(300), nullable=False, unique=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("photo_url", sa.String(2048), nullable=True),
        sa.Column("links", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
        ),
    )
    op.create_index("ix_authors_slug", "authors", ["slug"])
    op.create_index("ix_authors_user_id", "authors", ["user_id"])
    op.add_column(
        "articles",
        sa.Column(
            "author_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("authors.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_articles_author_profile_id", "articles", ["author_profile_id"])


def downgrade() -> None:
    op.drop_index("ix_articles_author_profile_id", "articles")
    op.drop_column("articles", "author_profile_id")
    op.drop_index("ix_authors_user_id", "authors")
    op.drop_index("ix_authors_slug", "authors")
    op.drop_table("authors")
