"""Public guest endpoints — list guests and get guest profile with articles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import GetGuestWithArticles, GuestNotFoundError
from app.domain.content.entities import Article, Guest
from app.infrastructure.content.repositories import SqlArticleRepository, SqlGuestRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import PublicArticleResponse
from app.interfaces.api.public.guests.schemas import (
    PublicGuestListResponse,
    PublicGuestResponse,
    PublicGuestWithArticlesResponse,
)

router = APIRouter(prefix="/api/guests", tags=["public-guests"])


def get_guest_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlGuestRepository:
    return SqlGuestRepository(session)


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _guest_response(g: Guest) -> PublicGuestResponse:
    return PublicGuestResponse(
        id=g.id,
        name=g.name,
        slug=g.slug.value,
        bio=g.bio,
        photo_url=g.photo_url,
        links=g.links,
    )


def _article_response(a: Article) -> PublicArticleResponse:
    return PublicArticleResponse(
        id=a.id,
        title=a.title,
        slug=a.slug.value,
        body=a.body.value,
        author_id=a.author_id,
        publish_at=a.publish_at,  # type: ignore[arg-type]
        spotify_url=a.spotify_url,
        excerpt=a.excerpt,
        cover_image_url=a.cover_image_url,
        cover_image_alt=a.cover_image_alt,
        meta_title=a.meta_title,
        meta_description=a.meta_description,
        og_image_url=a.og_image_url,
        reading_time=a.reading_time,
        category_id=a.category_id,
    )


@router.get("", response_model=PublicGuestListResponse)
def list_guests(
    repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
) -> PublicGuestListResponse:
    guests = repo.list_all()
    return PublicGuestListResponse(items=[_guest_response(g) for g in guests])


@router.get("/{slug}", response_model=PublicGuestWithArticlesResponse)
def get_guest_with_articles(
    slug: str,
    guest_repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
    article_repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    page: int = 1,
    page_size: int = 20,
) -> PublicGuestWithArticlesResponse:
    use_case = GetGuestWithArticles(guest_repo, article_repo)
    try:
        guest, articles, total = use_case.execute(slug=slug, page=page, page_size=page_size)
    except GuestNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found"
        )
    return PublicGuestWithArticlesResponse(
        id=guest.id,
        name=guest.name,
        slug=guest.slug.value,
        bio=guest.bio,
        photo_url=guest.photo_url,
        links=guest.links,
        articles=[_article_response(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )
