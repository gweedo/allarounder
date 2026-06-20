"""content: add slug_locked and spotify_url to articles

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-19 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("slug_locked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "articles",
        sa.Column("spotify_url", sa.String(2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("articles", "spotify_url")
    op.drop_column("articles", "slug_locked")
