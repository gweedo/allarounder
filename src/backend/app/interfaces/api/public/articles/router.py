"""Public article endpoints — read-only, published content only."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.domain.content.entities import Article, Author, Category, Guest, Tag
from app.domain.content.value_objects import PublicationStatus
from app.infrastructure.content.repositories import (
    SqlArticleRepository,
    SqlAuthorRepository,
    SqlCategoryRepository,
    SqlGuestRepository,
    SqlTagRepository,
)
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import (
    AuthorRef,
    CategoryRef,
    GuestRef,
    PublicArticleListResponse,
    PublicArticleResponse,
    TagRef,
)

router = APIRouter(prefix="/api/articles", tags=["public-articles"])


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def get_category_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlCategoryRepository:
    return SqlCategoryRepository(session)


def get_tag_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlTagRepository:
    return SqlTagRepository(session)


def get_author_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlAuthorRepository:
    return SqlAuthorRepository(session)


def get_guest_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlGuestRepository:
    return SqlGuestRepository(session)


def _category_ref(category: Category | None) -> CategoryRef | None:
    if category is None:
        return None
    return CategoryRef(id=category.id, name=category.name, slug=category.slug.value)


def _author_ref(author: Author | None) -> AuthorRef | None:
    if author is None:
        return None
    return AuthorRef(id=author.id, name=author.name, slug=author.slug.value)


def _to_response(
    article: Article,
    category: Category | None = None,
    tags: list[Tag] | None = None,
    author: Author | None = None,
    guests: list[Guest] | None = None,
) -> PublicArticleResponse:
    tag_refs = [TagRef(id=t.id, name=t.name, slug=t.slug.value) for t in (tags or [])]
    guest_refs = [GuestRef(id=g.id, name=g.name, slug=g.slug.value) for g in (guests or [])]
    return PublicArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug.value,
        body=article.body.value,
        author_id=article.author_id,
        publish_at=article.publish_at,  # type: ignore[arg-type]
        spotify_url=article.spotify_url,
        excerpt=article.excerpt,
        cover_image_url=article.cover_image_url,
        cover_image_alt=article.cover_image_alt,
        meta_title=article.meta_title,
        meta_description=article.meta_description,
        og_image_url=article.og_image_url,
        reading_time=article.reading_time,
        category_id=article.category_id,
        category=_category_ref(category),
        author_profile=_author_ref(author),
        tags=tag_refs,
        guests=guest_refs,
    )


@router.get("", response_model=PublicArticleListResponse)
def list_public_articles(
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    category_repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
) -> PublicArticleListResponse:
    now = datetime.now(tz=UTC)
    category_id = None
    if category is not None:
        cat = category_repo.get_by_slug(category)
        if cat is None:
            return PublicArticleListResponse(items=[], total=0, page=page, page_size=page_size)
        category_id = cat.id
    articles, total = repo.list_published(
        before=now, category_id=category_id, page=page, page_size=page_size
    )
    cat_cache: dict[uuid.UUID, Category | None] = {}
    responses = []
    for a in articles:
        cat_obj: Category | None = None
        if a.category_id is not None:
            if a.category_id not in cat_cache:
                cat_cache[a.category_id] = category_repo.get_by_id(a.category_id)
            cat_obj = cat_cache[a.category_id]
        responses.append(_to_response(a, cat_obj))
    return PublicArticleListResponse(
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{slug}", response_model=PublicArticleResponse)
def get_public_article(
    slug: str,
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    category_repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    tag_repo: Annotated[SqlTagRepository, Depends(get_tag_repo)],
    author_repo: Annotated[SqlAuthorRepository, Depends(get_author_repo)],
    guest_repo: Annotated[SqlGuestRepository, Depends(get_guest_repo)],
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
    cat: Category | None = None
    if article.category_id is not None:
        cat = category_repo.get_by_id(article.category_id)
    tags = tag_repo.get_by_article(article.id)
    author: Author | None = None
    if article.author_profile_id is not None:
        author = author_repo.get_by_id(article.author_profile_id)
    guests = guest_repo.get_by_article(article.id)
    return _to_response(article, cat, tags, author, guests)
