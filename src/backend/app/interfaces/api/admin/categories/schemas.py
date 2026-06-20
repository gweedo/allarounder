from uuid import UUID

from pydantic import BaseModel


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None


class CreateCategoryRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateCategoryRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class CategoryListResponse(BaseModel):
    items: list[CategoryResponse]
