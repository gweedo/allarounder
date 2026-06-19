from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateArticleRequest(BaseModel):
    title: str
    body: str = ""


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


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    page_size: int
