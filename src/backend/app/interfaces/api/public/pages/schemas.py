from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PublicPageResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    body: str
    meta_title: str | None = None
    meta_description: str | None = None
    updated_at: datetime
