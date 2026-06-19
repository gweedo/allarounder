"""SQLAlchemy implementation of ArticleRepository."""

import uuid

from sqlalchemy.orm import Session

from app.domain.content.entities import Article
from app.domain.content.value_objects import Body, PublicationStatus, Slug
from app.infrastructure.content.models import ArticleModel


def _model_to_article(m: ArticleModel) -> Article:
    return Article(
        id=m.id,
        title=m.title,
        slug=Slug(m.slug),
        body=Body(m.body),
        status=PublicationStatus(m.status),
        author_id=m.author_id,
        created_at=m.created_at,
        updated_at=m.updated_at,
        publish_at=m.publish_at,
    )


class SqlArticleRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, article: Article) -> None:
        m = ArticleModel(
            id=article.id,
            title=article.title,
            slug=article.slug.value,
            body=article.body.value,
            status=article.status.value,
            author_id=article.author_id,
            publish_at=article.publish_at,
            created_at=article.created_at,
            updated_at=article.updated_at,
        )
        self._session.add(m)

    def get_by_id(self, article_id: uuid.UUID) -> Article | None:
        m = self._session.get(ArticleModel, article_id)
        return _model_to_article(m) if m else None

    def list(
        self,
        *,
        author_id: uuid.UUID | None = None,
        status: PublicationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Article], int]:
        q = self._session.query(ArticleModel)
        if author_id is not None:
            q = q.filter_by(author_id=author_id)
        if status is not None:
            q = q.filter_by(status=status.value)
        total = q.count()
        rows = (
            q.order_by(ArticleModel.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return [_model_to_article(r) for r in rows], total
