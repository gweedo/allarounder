"""content: articles table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-19 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # create_type=False is only honoured by postgresql.ENUM, not the generic
    # sa.Enum. Create the type explicitly and idempotently, then reuse the same
    # object as the column type so create_table does not re-create it.
    status_enum = postgresql.ENUM(
        "draft", "published", "archived", name="publicationstatus", create_type=False
    )
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "articles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status",
            status_enum,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_articles_slug", "articles", ["slug"])
    op.create_index("ix_articles_author_id", "articles", ["author_id"])
    op.create_index("ix_articles_status", "articles", ["status"])


def downgrade() -> None:
    op.drop_table("articles")
    postgresql.ENUM(name="publicationstatus").drop(op.get_bind(), checkfirst=True)
