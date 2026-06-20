"""Public category endpoints — list all categories and get category with articles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import CategoryNotFoundError, GetCategoryWithArticles
from app.domain.content.entities import Article, Category
from app.infrastructure.content.repositories import SqlArticleRepository, SqlCategoryRepository
from app.interfaces.api.auth.dependencies import get_db_session
from app.interfaces.api.public.articles.schemas import CategoryRef, PublicArticleResponse
from app.interfaces.api.public.categories.schemas import (
    PublicCategoryListResponse,
    PublicCategoryResponse,
    PublicCategoryWithArticlesResponse,
)

router = APIRouter(prefix="/api/categories", tags=["public-categories"])


def get_category_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlCategoryRepository:
    return SqlCategoryRepository(session)


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _cat_response(c: Category) -> PublicCategoryResponse:
    return PublicCategoryResponse(
        id=c.id, name=c.name, slug=c.slug.value, description=c.description
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


@router.get("", response_model=PublicCategoryListResponse)
def list_categories(
    repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
) -> PublicCategoryListResponse:
    categories = repo.list_all()
    return PublicCategoryListResponse(items=[_cat_response(c) for c in categories])


@router.get("/{slug}", response_model=PublicCategoryWithArticlesResponse)
def get_category_with_articles(
    slug: str,
    category_repo: Annotated[SqlCategoryRepository, Depends(get_category_repo)],
    article_repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    page: int = 1,
    page_size: int = 20,
) -> PublicCategoryWithArticlesResponse:
    use_case = GetCategoryWithArticles(category_repo, article_repo)
    try:
        category, articles, total = use_case.execute(
            slug=slug, page=page, page_size=page_size
        )
    except CategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    cat_ref = CategoryRef(id=category.id, name=category.name, slug=category.slug.value)
    return PublicCategoryWithArticlesResponse(
        id=category.id,
        name=category.name,
        slug=category.slug.value,
        description=category.description,
        articles=[
            _article_response(a).model_copy(update={"category": cat_ref})
            for a in articles
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
