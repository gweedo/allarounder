"""SQLAlchemy implementations of ArticleRepository, CategoryRepository, TagRepository."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.domain.content.entities import Article, Category, Tag
from app.domain.content.value_objects import Body, PublicationStatus, Slug
from app.infrastructure.content.models import ArticleModel, CategoryModel, TagModel, article_tags


def _model_to_article(
    m: ArticleModel,
    tag_ids: list[uuid.UUID] | None = None,
) -> Article:
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
        slug_locked=m.slug_locked,
        preview_token=m.preview_token,
        spotify_url=m.spotify_url,
        excerpt=m.excerpt,
        cover_image_url=m.cover_image_url,
        cover_image_alt=m.cover_image_alt,
        meta_title=m.meta_title,
        meta_description=m.meta_description,
        og_image_url=m.og_image_url,
        reading_time=m.reading_time,
        category_id=m.category_id,
        tag_ids=tag_ids or [],
    )


def _model_to_tag(m: TagModel) -> Tag:
    return Tag(id=m.id, name=m.name, slug=Slug(m.slug))


def _model_to_category(m: CategoryModel) -> Category:
    return Category(
        id=m.id,
        name=m.name,
        slug=Slug(m.slug),
        description=m.description,
    )


class SqlTagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_article_tag_ids(self, article_id: uuid.UUID) -> list[uuid.UUID]:
        rows = self._session.execute(
            select(article_tags.c.tag_id).where(article_tags.c.article_id == article_id)
        ).scalars().all()
        return list(rows)

    def get_by_id(self, tag_id: uuid.UUID) -> Tag | None:
        m = self._session.get(TagModel, tag_id)
        return _model_to_tag(m) if m else None

    def get_by_slug(self, slug: str) -> Tag | None:
        m = self._session.query(TagModel).filter_by(slug=slug).one_or_none()
        return _model_to_tag(m) if m else None

    def get_or_create(self, name: str) -> Tag:
        m = self._session.query(TagModel).filter_by(name=name).one_or_none()
        if m is None:
            slug_val = Slug.from_title(name).value
            m = TagModel(id=uuid.uuid4(), name=name, slug=slug_val)
            self._session.add(m)
            self._session.flush()
        return _model_to_tag(m)

    def list_all(self) -> list[Tag]:
        rows = self._session.query(TagModel).order_by(TagModel.name).all()
        return [_model_to_tag(r) for r in rows]

    def get_by_article(self, article_id: uuid.UUID) -> list[Tag]:
        tag_ids = self._get_article_tag_ids(article_id)
        if not tag_ids:
            return []
        rows = self._session.query(TagModel).filter(TagModel.id.in_(tag_ids)).all()
        return [_model_to_tag(r) for r in rows]

    def set_article_tags(self, article_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> None:
        self._session.execute(
            delete(article_tags).where(article_tags.c.article_id == article_id)
        )
        if tag_ids:
            self._session.execute(
                insert(article_tags),
                [{"article_id": article_id, "tag_id": t} for t in tag_ids],
            )

    def delete(self, tag_id: uuid.UUID) -> None:
        m = self._session.get(TagModel, tag_id)
        if m is not None:
            self._session.delete(m)


class SqlCategoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, category: Category) -> None:
        m = CategoryModel(
            id=category.id,
            name=category.name,
            slug=category.slug.value,
            description=category.description,
        )
        self._session.add(m)

    def get_by_id(self, category_id: uuid.UUID) -> Category | None:
        m = self._session.get(CategoryModel, category_id)
        return _model_to_category(m) if m else None

    def get_by_slug(self, slug: str) -> Category | None:
        m = self._session.query(CategoryModel).filter_by(slug=slug).one_or_none()
        return _model_to_category(m) if m else None

    def list_all(self) -> list[Category]:
        rows = self._session.query(CategoryModel).order_by(CategoryModel.name).all()
        return [_model_to_category(r) for r in rows]

    def save(self, category: Category) -> None:
        m = self._session.get(CategoryModel, category.id)
        if m is None:
            raise ValueError(f"Category {category.id} not found in database")
        m.name = category.name
        m.slug = category.slug.value
        m.description = category.description

    def delete(self, category_id: uuid.UUID) -> None:
        m = self._session.get(CategoryModel, category_id)
        if m is not None:
            self._session.delete(m)


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
            category_id=article.category_id,
        )
        self._session.add(m)

    def _get_tag_ids(self, article_id: uuid.UUID) -> list[uuid.UUID]:
        return list(
            self._session.execute(
                select(article_tags.c.tag_id).where(article_tags.c.article_id == article_id)
            ).scalars().all()
        )

    def get_by_id(self, article_id: uuid.UUID) -> Article | None:
        m = self._session.get(ArticleModel, article_id)
        return _model_to_article(m, self._get_tag_ids(article_id)) if m else None

    def get_by_slug(self, slug: str) -> Article | None:
        m = self._session.query(ArticleModel).filter_by(slug=slug).one_or_none()
        return _model_to_article(m, self._get_tag_ids(m.id) if m else None) if m else None

    def get_by_preview_token(self, token: uuid.UUID) -> Article | None:
        m = self._session.query(ArticleModel).filter_by(preview_token=token).one_or_none()
        return _model_to_article(m, self._get_tag_ids(m.id) if m else None) if m else None

    def save(self, article: Article) -> None:
        m = self._session.get(ArticleModel, article.id)
        if m is None:
            raise ValueError(f"Article {article.id} not found in database")
        m.title = article.title
        m.slug = article.slug.value
        m.body = article.body.value
        m.status = article.status.value
        m.publish_at = article.publish_at
        m.updated_at = article.updated_at
        m.slug_locked = article.slug_locked
        m.preview_token = article.preview_token
        m.spotify_url = article.spotify_url
        m.excerpt = article.excerpt
        m.cover_image_url = article.cover_image_url
        m.cover_image_alt = article.cover_image_alt
        m.meta_title = article.meta_title
        m.meta_description = article.meta_description
        m.og_image_url = article.og_image_url
        m.reading_time = article.reading_time
        m.category_id = article.category_id

    def list_all(
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

    def list_published(
        self,
        *,
        before: datetime,
        category_id: uuid.UUID | None = None,
        tag_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Article], int]:
        q = (
            self._session.query(ArticleModel)
            .filter(ArticleModel.status == "published")
            .filter(ArticleModel.publish_at <= before)
        )
        if category_id is not None:
            q = q.filter(ArticleModel.category_id == category_id)
        if tag_id is not None:
            q = q.join(
                article_tags, article_tags.c.article_id == ArticleModel.id
            ).filter(article_tags.c.tag_id == tag_id)
        total = q.count()
        rows = (
            q.order_by(ArticleModel.publish_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return [_model_to_article(r) for r in rows], total
