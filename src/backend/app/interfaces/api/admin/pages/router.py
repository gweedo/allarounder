"""Admin pages endpoints — admin-only, static page management."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import UpdatePage
from app.domain.content.exceptions import PageNotFoundError
from app.domain.content.entities import StaticPage
from app.infrastructure.content.repositories import SqlPageRepository
from app.interfaces.api.admin.pages.schemas import (
    PageListResponse,
    PageResponse,
    UpdatePageRequest,
)
from app.interfaces.api.auth.dependencies import CurrentUser, get_db_session, require_admin

router = APIRouter(prefix="/api/admin/pages", tags=["admin-pages"])


def get_page_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlPageRepository:
    return SqlPageRepository(session)


def _to_response(p: StaticPage) -> PageResponse:
    return PageResponse(
        id=p.id,
        title=p.title,
        slug=p.slug.value,
        body=p.body,
        meta_title=p.meta_title,
        meta_description=p.meta_description,
        updated_at=p.updated_at,
    )


@router.get("", response_model=PageListResponse)
def list_pages(
    repo: Annotated[SqlPageRepository, Depends(get_page_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> PageListResponse:
    pages = repo.list_all()
    return PageListResponse(items=[_to_response(p) for p in pages])


@router.get("/{page_id}", response_model=PageResponse)
def get_page(
    page_id: uuid.UUID,
    repo: Annotated[SqlPageRepository, Depends(get_page_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> PageResponse:
    page = repo.get_by_id(page_id)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return _to_response(page)


@router.put("/{page_id}", response_model=PageResponse)
def update_page(
    page_id: uuid.UUID,
    body: UpdatePageRequest,
    repo: Annotated[SqlPageRepository, Depends(get_page_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> PageResponse:
    try:
        page = UpdatePage(repo).execute(
            page_id=page_id,
            title=body.title,
            body=body.body,
            meta_title=body.meta_title,
            meta_description=body.meta_description,
        )
    except PageNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return _to_response(page)
