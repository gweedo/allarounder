from uuid import UUID

from pydantic import BaseModel

from app.interfaces.api.public.articles.schemas import PublicArticleResponse


class PublicCategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None


class PublicCategoryWithArticlesResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    articles: list[PublicArticleResponse]
    total: int
    page: int
    page_size: int


class PublicCategoryListResponse(BaseModel):
    items: list[PublicCategoryResponse]
