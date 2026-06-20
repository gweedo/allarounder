from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CategoryRef(BaseModel):
    id: UUID
    name: str
    slug: str


class PublicArticleResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    body: str
    author_id: UUID
    publish_at: datetime
    spotify_url: str | None = None
    excerpt: str | None = None
    cover_image_url: str | None = None
    cover_image_alt: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None
    reading_time: int | None = None
    category_id: UUID | None = None
    category: CategoryRef | None = None


class PublicArticleListResponse(BaseModel):
    items: list[PublicArticleResponse]
    total: int
    page: int
    page_size: int
