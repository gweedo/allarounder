from uuid import UUID

from pydantic import BaseModel

from app.interfaces.api.public.articles.schemas import PublicArticleResponse


class PublicTagResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class PublicTagListResponse(BaseModel):
    items: list[PublicTagResponse]


class PublicTagWithArticlesResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    articles: list[PublicArticleResponse]
    total: int
    page: int
    page_size: int
