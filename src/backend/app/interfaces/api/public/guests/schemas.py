from uuid import UUID

from pydantic import BaseModel

from app.interfaces.api.public.articles.schemas import PublicArticleResponse


class PublicGuestResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}


class PublicGuestListResponse(BaseModel):
    items: list[PublicGuestResponse]


class PublicGuestWithArticlesResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}
    articles: list[PublicArticleResponse]
    total: int
    page: int
    page_size: int
