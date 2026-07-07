"""Admin tag endpoints — list all tags, rename, delete (admin-only mutations)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import DeleteTag, RenameTag, TagNotFoundError
from app.domain.content.entities import Tag
from app.infrastructure.content.repositories import SqlTagRepository
from app.interfaces.api.admin.tags.schemas import (
    TagListResponse,
    TagResponse,
    UpdateTagRequest,
)
from app.interfaces.api.auth.dependencies import (
    CurrentUser,
    get_db_session,
    require_admin,
    require_editor,
)

router = APIRouter(prefix="/api/admin/tags", tags=["admin-tags"])


def get_tag_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlTagRepository:
    return SqlTagRepository(session)


def _to_response(t: Tag) -> TagResponse:
    return TagResponse(id=t.id, name=t.name, slug=t.slug.value)


@router.get("", response_model=TagListResponse)
def list_tags(
    repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> TagListResponse:
    tags = repo.list_all()
    return TagListResponse(items=[_to_response(t) for t in tags])


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: uuid.UUID,
    body: UpdateTagRequest,
    repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> TagResponse:
    try:
        tag = RenameTag(repo).execute(tag_id=tag_id, name=body.name)
    except TagNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )
    return _to_response(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: uuid.UUID,
    repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> None:
    try:
        DeleteTag(repo).execute(tag_id=tag_id)
    except TagNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )
