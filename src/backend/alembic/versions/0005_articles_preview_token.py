"""content: add preview_token to articles

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("preview_token", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint("uq_articles_preview_token", "articles", ["preview_token"])


def downgrade() -> None:
    op.drop_constraint("uq_articles_preview_token", "articles")
    op.drop_column("articles", "preview_token")
