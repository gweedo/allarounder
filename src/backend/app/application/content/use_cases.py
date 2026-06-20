import uuid
from datetime import UTC, datetime

from app.domain.content.entities import Article, Author, Category, Tag
from app.domain.content.exceptions import ArticleNotFoundError
from app.domain.content.repositories import (
    ArticleRepository,
    AuthorRepository,
    CategoryRepository,
    TagRepository,
)
from app.domain.content.value_objects import Body, PublicationStatus, Slug, SpotifyUrl


class AuthorNotFoundError(Exception):
    pass


class CategoryNotFoundError(Exception):
    pass


class TagNotFoundError(Exception):
    pass


class CreateAuthor:
    def __init__(self, repo: AuthorRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        name: str,
        bio: str | None = None,
        photo_url: str | None = None,
        links: dict[str, str] | None = None,
        user_id: uuid.UUID | None = None,
    ) -> Author:
        now = datetime.now(tz=UTC)
        author = Author(
            id=uuid.uuid4(),
            name=name,
            slug=Slug.from_title(name),
            created_at=now,
            user_id=user_id,
            bio=bio,
            photo_url=photo_url,
            links=links or {},
        )
        self._repo.add(author)
        return author


class UpdateAuthor:
    def __init__(self, repo: AuthorRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        author_id: uuid.UUID,
        name: str | None = None,
        bio: str | None = None,
        photo_url: str | None = None,
        links: dict[str, str] | None = None,
        user_id: uuid.UUID | None = None,
        clear_user: bool = False,
    ) -> Author:
        author = self._repo.get_by_id(author_id)
        if author is None:
            raise AuthorNotFoundError(f"Author {author_id} not found")
        if name is not None:
            author.name = name
        if bio is not None:
            author.bio = bio
        if photo_url is not None:
            author.photo_url = photo_url
        if links is not None:
            author.links = links
        if clear_user:
            author.user_id = None
        elif user_id is not None:
            author.user_id = user_id
        self._repo.save(author)
        return author


class DeleteAuthor:
    def __init__(self, repo: AuthorRepository) -> None:
        self._repo = repo

    def execute(self, *, author_id: uuid.UUID) -> None:
        if self._repo.get_by_id(author_id) is None:
            raise AuthorNotFoundError(f"Author {author_id} not found")
        self._repo.delete(author_id)


class GetAuthorWithArticles:
    def __init__(
        self,
        author_repo: AuthorRepository,
        article_repo: ArticleRepository,
    ) -> None:
        self._author_repo = author_repo
        self._article_repo = article_repo

    def execute(
        self,
        *,
        slug: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Author, list[Article], int]:
        author = self._author_repo.get_by_slug(slug)
        if author is None:
            raise AuthorNotFoundError(f"Author '{slug}' not found")
        now = datetime.now(tz=UTC)
        articles, total = self._article_repo.list_published(
            before=now,
            author_profile_id=author.id,
            page=page,
            page_size=page_size,
        )
        return author, articles, total


class SetArticleTags:
    def __init__(self, tag_repo: TagRepository) -> None:
        self._tag_repo = tag_repo

    def execute(self, *, article_id: uuid.UUID, tag_names: list[str]) -> list[Tag]:
        tags = [self._tag_repo.get_or_create(name) for name in tag_names if name.strip()]
        tag_ids = [t.id for t in tags]
        self._tag_repo.set_article_tags(article_id, tag_ids)
        return tags


class DeleteTag:
    def __init__(self, repo: TagRepository) -> None:
        self._repo = repo

    def execute(self, *, tag_id: uuid.UUID) -> None:
        if self._repo.get_by_id(tag_id) is None:
            raise TagNotFoundError(f"Tag {tag_id} not found")
        self._repo.delete(tag_id)


class GetTagWithArticles:
    def __init__(
        self,
        tag_repo: TagRepository,
        article_repo: ArticleRepository,
    ) -> None:
        self._tag_repo = tag_repo
        self._article_repo = article_repo

    def execute(
        self,
        *,
        slug: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Tag, list[Article], int]:
        tag = self._tag_repo.get_by_slug(slug)
        if tag is None:
            raise TagNotFoundError(f"Tag '{slug}' not found")
        now = datetime.now(tz=UTC)
        articles, total = self._article_repo.list_published(
            before=now,
            tag_id=tag.id,
            page=page,
            page_size=page_size,
        )
        return tag, articles, total


class CreateCategory:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    def execute(self, *, name: str, description: str | None = None) -> Category:
        category = Category(
            id=uuid.uuid4(),
            name=name,
            slug=Slug.from_title(name),
            description=description,
        )
        self._repo.add(category)
        return category


class UpdateCategory:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    def execute(
        self,
        *,
        category_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
    ) -> Category:
        category = self._repo.get_by_id(category_id)
        if category is None:
            raise CategoryNotFoundError(f"Category {category_id} not found")
        if name is not None:
            category.name = name
        if description is not None:
            category.description = description
        self._repo.save(category)
        return category


class DeleteCategory:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    def execute(self, *, category_id: uuid.UUID) -> None:
        if self._repo.get_by_id(category_id) is None:
            raise CategoryNotFoundError(f"Category {category_id} not found")
        self._repo.delete(category_id)


class GetCategoryWithArticles:
    def __init__(
        self,
        category_repo: CategoryRepository,
        article_repo: ArticleRepository,
    ) -> None:
        self._category_repo = category_repo
        self._article_repo = article_repo

    def execute(
        self,
        *,
        slug: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Category, list[Article], int]:
        category = self._category_repo.get_by_slug(slug)
        if category is None:
            raise CategoryNotFoundError(f"Category '{slug}' not found")
        now = datetime.now(tz=UTC)
        articles, total = self._article_repo.list_published(
            before=now,
            category_id=category.id,
            page=page,
            page_size=page_size,
        )
        return category, articles, total


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
        category_id: uuid.UUID | None = None,
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
            category_id=category_id,
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
        category_id: uuid.UUID | None = None,
        author_profile_id: uuid.UUID | None = None,
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
        if category_id is not None:
            article.category_id = category_id
        if author_profile_id is not None:
            article.author_profile_id = author_profile_id
        article.updated_at = datetime.now(tz=UTC)
        self._repo.save(article)
        return article


class GeneratePreviewToken:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    def execute(self, *, article_id: uuid.UUID) -> tuple[Article, str]:
        article = self._repo.get_by_id(article_id)
        if article is None:
            raise ArticleNotFoundError(f"Article {article_id} not found")
        article.preview_token = uuid.uuid4()
        article.updated_at = datetime.now(tz=UTC)
        self._repo.save(article)
        preview_url = f"/preview/articles/{article.preview_token}"
        return article, preview_url
