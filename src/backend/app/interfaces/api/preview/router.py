"""Preview endpoint — unauthenticated, token-gated article preview."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.infrastructure.content.repositories import SqlArticleRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import PublicArticleResponse

router = APIRouter(prefix="/api/preview", tags=["preview"])


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


@router.get("/articles/{token}", response_model=PublicArticleResponse)
def get_preview_article(
    token: uuid.UUID,
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> PublicArticleResponse:
    article = repo.get_by_preview_token(token)
    if article is None or article.preview_token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not found")
    return PublicArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug.value,
        body=article.body.value,
        author_id=article.author_id,
        publish_at=article.publish_at or article.updated_at,
        spotify_url=article.spotify_url,
        excerpt=article.excerpt,
        cover_image_url=article.cover_image_url,
        cover_image_alt=article.cover_image_alt,
        meta_title=article.meta_title,
        meta_description=article.meta_description,
        og_image_url=article.og_image_url,
        reading_time=article.reading_time,
    )
