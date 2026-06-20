"""Admin author endpoints — CRUD, admin-only."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import (
    AuthorNotFoundError,
    CreateAuthor,
    DeleteAuthor,
    UpdateAuthor,
)
from app.domain.content.entities import Author
from app.infrastructure.content.repositories import SqlAuthorRepository
from app.interfaces.api.admin.authors.schemas import (
    AuthorListResponse,
    AuthorResponse,
    CreateAuthorRequest,
    UpdateAuthorRequest,
)
from app.interfaces.api.auth.dependencies import CurrentUser, get_db_session, require_admin

router = APIRouter(prefix="/api/admin/authors", tags=["admin-authors"])


def get_author_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlAuthorRepository:
    return SqlAuthorRepository(session)


def _to_response(a: Author) -> AuthorResponse:
    return AuthorResponse(
        id=a.id,
        name=a.name,
        slug=a.slug.value,
        bio=a.bio,
        photo_url=a.photo_url,
        links=a.links,
        user_id=a.user_id,
        created_at=a.created_at,
    )


@router.get("", response_model=AuthorListResponse)
def list_authors(
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> AuthorListResponse:
    authors = repo.list_all()
    return AuthorListResponse(items=[_to_response(a) for a in authors])


@router.post("", response_model=AuthorResponse, status_code=status.HTTP_201_CREATED)
def create_author(
    body: CreateAuthorRequest,
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> AuthorResponse:
    author = CreateAuthor(repo).execute(
        name=body.name,
        bio=body.bio,
        photo_url=body.photo_url,
        links=body.links,
        user_id=body.user_id,
    )
    return _to_response(author)


@router.get("/{author_id}", response_model=AuthorResponse)
def get_author(
    author_id: uuid.UUID,
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> AuthorResponse:
    author = repo.get_by_id(author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
    return _to_response(author)


@router.put("/{author_id}", response_model=AuthorResponse)
def update_author(
    author_id: uuid.UUID,
    body: UpdateAuthorRequest,
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> AuthorResponse:
    try:
        author = UpdateAuthor(repo).execute(
            author_id=author_id,
            name=body.name,
            bio=body.bio,
            photo_url=body.photo_url,
            links=body.links,
            user_id=body.user_id,
            clear_user=body.clear_user,
        )
    except AuthorNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
    return _to_response(author)


@router.delete("/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_author(
    author_id: uuid.UUID,
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    _: Annotated[CurrentUser, Depends(require_admin)],
) -> None:
    try:
        DeleteAuthor(repo).execute(author_id=author_id)
    except AuthorNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
