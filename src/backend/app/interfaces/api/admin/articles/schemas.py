from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateArticleRequest(BaseModel):
    title: str
    body: str = ""


class UpdateArticleRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    slug: str | None = None
    publish_at: datetime | None = None
    spotify_url: str | None = None


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
    spotify_url: str | None = None


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    page_size: int
