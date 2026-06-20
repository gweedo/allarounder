from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PublicArticleResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    body: str
    author_id: UUID
    publish_at: datetime
    spotify_url: str | None = None


class PublicArticleListResponse(BaseModel):
    items: list[PublicArticleResponse]
    total: int
    page: int
    page_size: int
