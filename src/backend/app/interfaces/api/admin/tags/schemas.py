from uuid import UUID

from pydantic import BaseModel


class TagResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class TagListResponse(BaseModel):
    items: list[TagResponse]
