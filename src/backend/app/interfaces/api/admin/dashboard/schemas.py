from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardArticleItem(BaseModel):
    id: UUID
    title: str
    author_name: str
    created_at: datetime
    updated_at: datetime


class DashboardResponse(BaseModel):
    my_published: list[DashboardArticleItem]
    all_drafts: list[DashboardArticleItem]
