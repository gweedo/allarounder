"""content: add media and SEO fields to articles

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("excerpt", sa.String(300), nullable=True))
    op.add_column("articles", sa.Column("cover_image_url", sa.String(2048), nullable=True))
    op.add_column("articles", sa.Column("cover_image_alt", sa.String(160), nullable=True))
    op.add_column("articles", sa.Column("meta_title", sa.String(60), nullable=True))
    op.add_column("articles", sa.Column("meta_description", sa.String(160), nullable=True))
    op.add_column("articles", sa.Column("og_image_url", sa.String(2048), nullable=True))
    op.add_column("articles", sa.Column("reading_time", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("articles", "reading_time")
    op.drop_column("articles", "og_image_url")
    op.drop_column("articles", "meta_description")
    op.drop_column("articles", "meta_title")
    op.drop_column("articles", "cover_image_alt")
    op.drop_column("articles", "cover_image_url")
    op.drop_column("articles", "excerpt")
