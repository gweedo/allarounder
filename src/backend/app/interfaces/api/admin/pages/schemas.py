from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PageResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    body: str
    meta_title: str | None = None
    meta_description: str | None = None
    updated_at: datetime


class PageListResponse(BaseModel):
    items: list[PageResponse]


class UpdatePageRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
