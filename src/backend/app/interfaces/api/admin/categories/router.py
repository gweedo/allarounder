"""Admin category endpoints — CRUD for categories (admin only for write operations)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import (
    CategoryNotFoundError,
    CreateCategory,
    DeleteCategory,
    UpdateCategory,
)
from app.domain.content.entities import Category
from app.infrastructure.content.repositories import SqlCategoryRepository
from app.interfaces.api.admin.categories.schemas import (
    CategoryListResponse,
    CategoryResponse,
    CreateCategoryRequest,
    UpdateCategoryRequest,
)
from app.interfaces.api.auth.dependencies import (
    CurrentUser,
    get_db_session,
    require_admin,
    require_editor,
)

router = APIRouter(prefix="/api/admin/categories", tags=["admin-categories"])


def get_category_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlCategoryRepository:
    return SqlCategoryRepository(session)


def _to_response(c: Category) -> CategoryResponse:
    return CategoryResponse(
        id=c.id, name=c.name, slug=c.slug.value, description=c.description
    )


@router.get("", response_model=CategoryListResponse)
def list_categories(
    repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> CategoryListResponse:
    categories = repo.list_all()
    return CategoryListResponse(items=[_to_response(c) for c in categories])


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CreateCategoryRequest,
    repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> CategoryResponse:
    category = CreateCategory(repo).execute(name=body.name, description=body.description)
    return _to_response(category)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: uuid.UUID,
    body: UpdateCategoryRequest,
    repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> CategoryResponse:
    try:
        category = UpdateCategory(repo).execute(
            category_id=category_id,
            name=body.name,
            description=body.description,
        )
    except CategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return _to_response(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: uuid.UUID,
    repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> None:
    try:
        DeleteCategory(repo).execute(category_id=category_id)
    except CategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
