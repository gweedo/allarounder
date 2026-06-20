from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuthorResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}
    user_id: UUID | None = None
    created_at: datetime


class AuthorListResponse(BaseModel):
    items: list[AuthorResponse]


class CreateAuthorRequest(BaseModel):
    name: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}
    user_id: UUID | None = None


class UpdateAuthorRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] | None = None
    user_id: UUID | None = None
    clear_user: bool = False
