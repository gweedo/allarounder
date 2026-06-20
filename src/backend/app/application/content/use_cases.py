import uuid
from datetime import UTC, datetime

from app.domain.content.entities import Article
from app.domain.content.exceptions import ArticleNotFoundError
from app.domain.content.repositories import ArticleRepository
from app.domain.content.value_objects import Body, PublicationStatus, Slug, SpotifyUrl


class CreateArticle:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        title: str,
        author_id: uuid.UUID,
        body: str = "",
        publish_at: datetime | None = None,
        excerpt: str | None = None,
        spotify_url: str | None = None,
    ) -> Article:
        now = datetime.now(tz=UTC)
        body_vo = Body(body)
        validated_spotify: str | None = None
        if spotify_url:
            validated_spotify = SpotifyUrl(spotify_url).value
        article = Article(
            id=uuid.uuid4(),
            title=title,
            slug=Slug.from_title(title),
            body=body_vo,
            status=PublicationStatus.draft,
            author_id=author_id,
            created_at=now,
            updated_at=now,
            publish_at=publish_at,
            excerpt=excerpt,
            spotify_url=validated_spotify,
            reading_time=body_vo.reading_time_minutes() if body else None,
        )
        self._repo.add(article)
        return article


class PublishArticle:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        article_id: uuid.UUID,
        publish_at: datetime | None = None,
    ) -> Article:
        article = self._repo.get_by_id(article_id)
        if article is None:
            raise ArticleNotFoundError(f"Article {article_id} not found")
        now = datetime.now(tz=UTC)
        if publish_at is not None:
            article.publish_at = publish_at
        article.publish(now)
        self._repo.save(article)
        return article


class ArchiveArticle:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    def execute(self, *, article_id: uuid.UUID) -> Article:
        article = self._repo.get_by_id(article_id)
        if article is None:
            raise ArticleNotFoundError(f"Article {article_id} not found")
        article.archive(datetime.now(tz=UTC))
        self._repo.save(article)
        return article


class UpdateArticle:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        article_id: uuid.UUID,
        title: str | None = None,
        body: str | None = None,
        slug: str | None = None,
        publish_at: datetime | None = None,
        spotify_url: str | None = None,
        excerpt: str | None = None,
        cover_image_url: str | None = None,
        cover_image_alt: str | None = None,
        meta_title: str | None = None,
        meta_description: str | None = None,
        og_image_url: str | None = None,
    ) -> Article:
        article = self._repo.get_by_id(article_id)
        if article is None:
            raise ArticleNotFoundError(f"Article {article_id} not found")
        if title is not None:
            article.title = title
        if body is not None:
            article.body = Body(body)
            article.reading_time = article.body.reading_time_minutes()
        if slug is not None:
            article.set_slug(Slug(slug))
        if publish_at is not None:
            article.publish_at = publish_at
        if spotify_url is not None:
            article.spotify_url = SpotifyUrl(spotify_url).value if spotify_url else None
        if excerpt is not None:
            article.excerpt = excerpt
        if cover_image_url is not None:
            article.cover_image_url = cover_image_url
        if cover_image_alt is not None:
            article.cover_image_alt = cover_image_alt
        if meta_title is not None:
            article.meta_title = meta_title
        if meta_description is not None:
            article.meta_description = meta_description
        if og_image_url is not None:
            article.og_image_url = og_image_url
        article.updated_at = datetime.now(tz=UTC)
        self._repo.save(article)
        return article
