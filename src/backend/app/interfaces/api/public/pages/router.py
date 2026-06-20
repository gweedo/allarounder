"""Public page endpoints — read-only, static pages only."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import GetPage
from app.domain.content.exceptions import PageNotFoundError
from app.infrastructure.content.repositories import SqlPageRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.pages.schemas import PublicPageResponse

router = APIRouter(prefix="/api/pages", tags=["public-pages"])


def get_page_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlPageRepository:
    return SqlPageRepository(session)


@router.get("/{slug}", response_model=PublicPageResponse)
def get_public_page(
    slug: str,
    repo: Annotated[SqlPageRepository, Depends(get_page_repo)],
) -> PublicPageResponse:
    try:
        page = GetPage(repo).execute(slug=slug)
    except PageNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return PublicPageResponse(
        id=page.id,
        title=page.title,
        slug=page.slug.value,
        body=page.body,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        updated_at=page.updated_at,
    )
