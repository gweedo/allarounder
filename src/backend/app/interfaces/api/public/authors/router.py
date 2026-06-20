"""Public author endpoints — list authors and get author profile with articles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import AuthorNotFoundError, GetAuthorWithArticles
from app.domain.content.entities import Article, Author
from app.infrastructure.content.repositories import SqlArticleRepository, SqlAuthorRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import PublicArticleResponse
from app.interfaces.api.public.authors.schemas import (
    PublicAuthorListResponse,
    PublicAuthorResponse,
    PublicAuthorWithArticlesResponse,
)

router = APIRouter(prefix="/api/authors", tags=["public-authors"])


def get_author_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlAuthorRepository:
    return SqlAuthorRepository(session)


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _author_response(a: Author) -> PublicAuthorResponse:
    return PublicAuthorResponse(
        id=a.id,
        name=a.name,
        slug=a.slug.value,
        bio=a.bio,
        photo_url=a.photo_url,
        links=a.links,
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


@router.get("", response_model=PublicAuthorListResponse)
def list_authors(
    repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
) -> PublicAuthorListResponse:
    authors = repo.list_all()
    return PublicAuthorListResponse(items=[_author_response(a) for a in authors])


@router.get("/{slug}", response_model=PublicAuthorWithArticlesResponse)
def get_author_with_articles(
    slug: str,
    author_repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    article_repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    page: int = 1,
    page_size: int = 20,
) -> PublicAuthorWithArticlesResponse:
    use_case = GetAuthorWithArticles(author_repo, article_repo)
    try:
        author, articles, total = use_case.execute(slug=slug, page=page, page_size=page_size)
    except AuthorNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Author not found"
        )
    return PublicAuthorWithArticlesResponse(
        id=author.id,
        name=author.name,
        slug=author.slug.value,
        bio=author.bio,
        photo_url=author.photo_url,
        links=author.links,
        articles=[_article_response(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )
