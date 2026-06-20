"""Public article endpoints — read-only, published content only."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.domain.content.entities import Article
from app.domain.content.value_objects import PublicationStatus
from app.infrastructure.content.repositories import SqlArticleRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import (
    PublicArticleListResponse,
    PublicArticleResponse,
)

router = APIRouter(prefix="/api/articles", tags=["public-articles"])


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _to_response(article: Article) -> PublicArticleResponse:
    return PublicArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug.value,
        body=article.body.value,
        author_id=article.author_id,
        publish_at=article.publish_at,  # type: ignore[arg-type]
        spotify_url=article.spotify_url,
    )


@router.get("", response_model=PublicArticleListResponse)
def list_public_articles(
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    page: int = 1,
    page_size: int = 20,
) -> PublicArticleListResponse:
    now = datetime.now(tz=UTC)
    articles, total = repo.list_published(before=now, page=page, page_size=page_size)
    return PublicArticleListResponse(
        items=[_to_response(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{slug}", response_model=PublicArticleResponse)
def get_public_article(
    slug: str,
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> PublicArticleResponse:
    now = datetime.now(tz=UTC)
    article = repo.get_by_slug(slug)
    if (
        article is None
        or article.status != PublicationStatus.published
        or article.publish_at is None
        or article.publish_at > now
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _to_response(article)
