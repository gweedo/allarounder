from uuid import UUID

from pydantic import BaseModel, Field


class TagResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class TagListResponse(BaseModel):
    items: list[TagResponse]


class UpdateTagRequest(BaseModel):
    name: str = Field(min_length=1)
