from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.content.value_objects import META_DESCRIPTION_MAX_LENGTH, META_TITLE_MAX_LENGTH


class CreateArticleRequest(BaseModel):
    title: str
    body: str = ""
    excerpt: str | None = None
    spotify_url: str | None = None
    category_id: UUID | None = None


class UpdateArticleRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    slug: str | None = None
    publish_at: datetime | None = None
    spotify_url: str | None = None
    excerpt: str | None = None
    cover_image_url: str | None = None
    cover_image_alt: str | None = None
    meta_title: str | None = Field(default=None, max_length=META_TITLE_MAX_LENGTH)
    meta_description: str | None = Field(default=None, max_length=META_DESCRIPTION_MAX_LENGTH)
    og_image_url: str | None = None
    category_id: UUID | None = None
    tags: list[str] | None = None
    guest_ids: list[UUID] | None = None


class ArticleResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    body: str
    status: str
    author_id: UUID
    created_at: datetime
    updated_at: datetime
    publish_at: datetime | None = None
    slug_locked: bool = False
    preview_token: UUID | None = None
    spotify_url: str | None = None
    excerpt: str | None = None
    cover_image_url: str | None = None
    cover_image_alt: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None
    reading_time: int | None = None
    category_id: UUID | None = None
    tags: list[str] = []
    guest_ids: list[UUID] = []


class PreviewTokenResponse(BaseModel):
    preview_url: str


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    page_size: int
