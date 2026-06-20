from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GuestResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}
    created_at: datetime


class GuestListResponse(BaseModel):
    items: list[GuestResponse]


class CreateGuestRequest(BaseModel):
    name: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = {}


class UpdateGuestRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] | None = None
