from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.content.value_objects import META_DESCRIPTION_MAX_LENGTH, META_TITLE_MAX_LENGTH


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
    meta_title: str | None = Field(default=None, max_length=META_TITLE_MAX_LENGTH)
    meta_description: str | None = Field(default=None, max_length=META_DESCRIPTION_MAX_LENGTH)
