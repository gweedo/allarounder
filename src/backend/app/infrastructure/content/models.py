"""SQLAlchemy ORM model for the content context."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class ArticleModel(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "archived", name="publicationstatus"),
        nullable=False,
        server_default="draft",
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slug_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    spotify_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    excerpt: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    cover_image_alt: Mapped[str | None] = mapped_column(String(160), nullable=True)
    meta_title: Mapped[str | None] = mapped_column(String(60), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(160), nullable=True)
    og_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    reading_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
