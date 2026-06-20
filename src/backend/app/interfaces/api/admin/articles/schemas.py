from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateArticleRequest(BaseModel):
    title: str
    body: str = ""
    excerpt: str | None = None
    spotify_url: str | None = None


class UpdateArticleRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    slug: str | None = None
    publish_at: datetime | None = None
    spotify_url: str | None = None
    excerpt: str | None = None
    cover_image_url: str | None = None
    cover_image_alt: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None


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


class PreviewTokenResponse(BaseModel):
    preview_url: str


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    page_size: int
