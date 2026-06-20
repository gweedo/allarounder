"""Admin guest endpoints — CRUD, editor and admin access."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import (
    CreateGuest,
    DeleteGuest,
    GuestNotFoundError,
    UpdateGuest,
)
from app.domain.content.entities import Guest
from app.infrastructure.content.repositories import SqlGuestRepository
from app.interfaces.api.admin.guests.schemas import (
    CreateGuestRequest,
    GuestListResponse,
    GuestResponse,
    UpdateGuestRequest,
)
from app.interfaces.api.auth.dependencies import CurrentUser, get_db_session, require_editor

router = APIRouter(prefix="/api/admin/guests", tags=["admin-guests"])


def get_guest_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlGuestRepository:
    return SqlGuestRepository(session)


def _to_response(g: Guest) -> GuestResponse:
    return GuestResponse(
        id=g.id,
        name=g.name,
        slug=g.slug.value,
        bio=g.bio,
        photo_url=g.photo_url,
        links=g.links,
        created_at=g.created_at,
    )


@router.get("", response_model=GuestListResponse)
def list_guests(
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> GuestListResponse:
    guests = repo.list_all()
    return GuestListResponse(items=[_to_response(g) for g in guests])


@router.post("", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
def create_guest(
    body: CreateGuestRequest,
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> GuestResponse:
    guest = CreateGuest(repo).execute(
        name=body.name,
        bio=body.bio,
        photo_url=body.photo_url,
        links=body.links,
    )
    return _to_response(guest)


@router.get("/{guest_id}", response_model=GuestResponse)
def get_guest(
    guest_id: uuid.UUID,
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> GuestResponse:
    guest = repo.get_by_id(guest_id)
    if guest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return _to_response(guest)


@router.put("/{guest_id}", response_model=GuestResponse)
def update_guest(
    guest_id: uuid.UUID,
    body: UpdateGuestRequest,
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> GuestResponse:
    try:
        guest = UpdateGuest(repo).execute(
            guest_id=guest_id,
            name=body.name,
            bio=body.bio,
            photo_url=body.photo_url,
            links=body.links,
        )
    except GuestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return _to_response(guest)


@router.delete("/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guest(
    guest_id: uuid.UUID,
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    _: Annotated[CurrentUser, Depends(require_editor)],
) -> None:
    try:
        DeleteGuest(repo).execute(guest_id=guest_id)
    except GuestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
