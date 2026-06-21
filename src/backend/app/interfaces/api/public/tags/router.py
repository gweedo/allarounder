"""Public tag endpoints — list tags and get tag with paginated articles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import GetTagWithArticles, TagNotFoundError
from app.domain.content.entities import Article, Tag
from app.infrastructure.content.repositories import SqlArticleRepository, SqlTagRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import PublicArticleResponse
from app.interfaces.api.public.tags.schemas import (
    PublicTagListResponse,
    PublicTagResponse,
    PublicTagWithArticlesResponse,
)

router = APIRouter(prefix="/api/tags", tags=["public-tags"])


def get_tag_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlTagRepository:
    return SqlTagRepository(session)


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _tag_response(t: Tag) -> PublicTagResponse:
    return PublicTagResponse(id=t.id, name=t.name, slug=t.slug.value)


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
        updated_at=a.updated_at,
        reading_time=a.reading_time,
        category_id=a.category_id,
    )


@router.get("", response_model=PublicTagListResponse)
def list_tags(
    repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
) -> PublicTagListResponse:
    tags = repo.list_all()
    return PublicTagListResponse(items=[_tag_response(t) for t in tags])


@router.get("/{slug}", response_model=PublicTagWithArticlesResponse)
def get_tag_with_articles(
    slug: str,
    tag_repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
    article_repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    page: int = 1,
    page_size: int = 20,
) -> PublicTagWithArticlesResponse:
    use_case = GetTagWithArticles(tag_repo, article_repo)
    try:
        tag, articles, total = use_case.execute(slug=slug, page=page, page_size=page_size)
    except TagNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )
    return PublicTagWithArticlesResponse(
        id=tag.id,
        name=tag.name,
        slug=tag.slug.value,
        articles=[_article_response(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )
