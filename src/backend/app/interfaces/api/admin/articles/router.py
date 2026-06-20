"""Admin article endpoints: create draft, list, publish, archive, update."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.application.content.use_cases import (
    ArchiveArticle,
    CreateArticle,
    GeneratePreviewToken,
    PublishArticle,
    UpdateArticle,
)
from app.domain.content.entities import Article
from app.domain.content.exceptions import ArticleNotFoundError, SlugLockedError
from app.domain.content.value_objects import PublicationStatus
from app.infrastructure.content.repositories import SqlArticleRepository
from app.interfaces.api.admin.articles.schemas import (
    ArticleListResponse,
    ArticleResponse,
    CreateArticleRequest,
    PreviewTokenResponse,
    UpdateArticleRequest,
)
from app.interfaces.api.auth.dependencies import (
    CurrentUser,
    get_db_session,
    require_editor,
)

router = APIRouter(prefix="/api/admin/articles", tags=["articles"])


def get_article_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> SqlArticleRepository:
    return SqlArticleRepository(session)


def _to_response(article: Article) -> ArticleResponse:
    return ArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug.value,
        body=article.body.value,
        status=article.status.value,
        author_id=article.author_id,
        created_at=article.created_at,
        updated_at=article.updated_at,
        publish_at=article.publish_at,
        slug_locked=article.slug_locked,
        preview_token=article.preview_token,
        spotify_url=article.spotify_url,
        excerpt=article.excerpt,
        cover_image_url=article.cover_image_url,
        cover_image_alt=article.cover_image_alt,
        meta_title=article.meta_title,
        meta_description=article.meta_description,
        og_image_url=article.og_image_url,
        reading_time=article.reading_time,
    )


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    body: CreateArticleRequest,
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> ArticleResponse:
    use_case = CreateArticle(repo)
    try:
        article = use_case.execute(
            title=body.title,
            author_id=uuid.UUID(current_user.user_id),
            body=body.body,
            excerpt=body.excerpt,
            spotify_url=body.spotify_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(article)


@router.get("", response_model=ArticleListResponse)
def list_articles(
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
    article_status: Annotated[str | None, Query(alias="status")] = None,
    page: int = 1,
    page_size: int = 20,
) -> ArticleListResponse:
    filter_status: PublicationStatus | None = None
    if article_status is not None:
        try:
            filter_status = PublicationStatus(article_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid status: {article_status!r}",
            )

    author_id: uuid.UUID | None = None
    if current_user.role != "admin":
        author_id = uuid.UUID(current_user.user_id)

    articles, total = repo.list_all(
        author_id=author_id,
        status=filter_status,
        page=page,
        page_size=page_size,
    )
    return ArticleListResponse(
        items=[_to_response(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.put("/{article_id}", response_model=ArticleResponse)
def update_article(
    article_id: uuid.UUID,
    body: UpdateArticleRequest,
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> ArticleResponse:
    use_case = UpdateArticle(repo)
    try:
        article = use_case.execute(
            article_id=article_id,
            title=body.title,
            body=body.body,
            slug=body.slug,
            publish_at=body.publish_at,
            spotify_url=body.spotify_url,
            excerpt=body.excerpt,
            cover_image_url=body.cover_image_url,
            cover_image_alt=body.cover_image_alt,
            meta_title=body.meta_title,
            meta_description=body.meta_description,
            og_image_url=body.og_image_url,
        )
    except ArticleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    except SlugLockedError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(article)


@router.post("/{article_id}/publish", response_model=ArticleResponse)
def publish_article(
    article_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> ArticleResponse:
    use_case = PublishArticle(repo)
    try:
        article = use_case.execute(article_id=article_id)
    except ArticleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _to_response(article)


@router.post("/{article_id}/preview-token", response_model=PreviewTokenResponse)
def generate_preview_token(
    article_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> PreviewTokenResponse:
    use_case = GeneratePreviewToken(repo)
    try:
        _, preview_url = use_case.execute(article_id=article_id)
    except ArticleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return PreviewTokenResponse(preview_url=preview_url)


@router.post("/{article_id}/archive", response_model=ArticleResponse)
def archive_article(
    article_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    repo: Annotated[SqlArticleRepository, Depends(get_article_repo)],
) -> ArticleResponse:
    use_case = ArchiveArticle(repo)
    try:
        article = use_case.execute(article_id=article_id)
    except ArticleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _to_response(article)
