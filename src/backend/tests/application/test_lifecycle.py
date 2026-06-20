"""Application-layer tests for PublishArticle, ArchiveArticle, UpdateArticle use cases."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.application.content.use_cases import ArchiveArticle, PublishArticle, UpdateArticle
from app.domain.content.entities import Article
from app.domain.content.exceptions import ArticleNotFoundError, SlugLockedError
from app.domain.content.value_objects import Body, PublicationStatus, Slug


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_article(status: PublicationStatus = PublicationStatus.draft) -> Article:
    now = _now()
    return Article(
        id=uuid.uuid4(),
        title="Come Allenarsi",
        slug=Slug("come-allenarsi"),
        body=Body("contenuto"),
        status=status,
        author_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )


def _mock_repo(article: Article | None) -> MagicMock:
    repo = MagicMock()
    repo.get_by_id.return_value = article
    return repo


class TestPublishArticle:
    def test_sets_status_published(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        PublishArticle(repo).execute(article_id=article.id)
        assert article.status == PublicationStatus.published

    def test_locks_slug(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        PublishArticle(repo).execute(article_id=article.id)
        assert article.slug_locked is True

    def test_sets_publish_at_when_not_set(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        PublishArticle(repo).execute(article_id=article.id)
        assert article.publish_at is not None

    def test_respects_explicit_publish_at(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        scheduled = _now() + timedelta(days=1)
        PublishArticle(repo).execute(article_id=article.id, publish_at=scheduled)
        assert article.publish_at == scheduled

    def test_calls_save(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        PublishArticle(repo).execute(article_id=article.id)
        repo.save.assert_called_once_with(article)

    def test_raises_not_found(self) -> None:
        repo = _mock_repo(None)
        with pytest.raises(ArticleNotFoundError):
            PublishArticle(repo).execute(article_id=uuid.uuid4())


class TestArchiveArticle:
    def test_sets_status_archived(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        ArchiveArticle(repo).execute(article_id=article.id)
        assert article.status == PublicationStatus.archived

    def test_calls_save(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        ArchiveArticle(repo).execute(article_id=article.id)
        repo.save.assert_called_once_with(article)

    def test_raises_not_found(self) -> None:
        repo = _mock_repo(None)
        with pytest.raises(ArticleNotFoundError):
            ArchiveArticle(repo).execute(article_id=uuid.uuid4())


class TestUpdateArticle:
    def test_updates_title(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        UpdateArticle(repo).execute(article_id=article.id, title="Nuovo Titolo")
        assert article.title == "Nuovo Titolo"

    def test_updates_body(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        UpdateArticle(repo).execute(article_id=article.id, body="nuovo testo")
        assert article.body.value == "nuovo testo"

    def test_updates_slug_on_draft(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        UpdateArticle(repo).execute(article_id=article.id, slug="nuova-slug")
        assert article.slug.value == "nuova-slug"

    def test_raises_slug_locked_on_published(self) -> None:
        article = _make_article()
        article.publish(_now())
        repo = _mock_repo(article)
        with pytest.raises(SlugLockedError):
            UpdateArticle(repo).execute(article_id=article.id, slug="altra-slug")

    def test_updates_spotify_url(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        UpdateArticle(repo).execute(
            article_id=article.id, spotify_url="https://open.spotify.com/episode/abc"
        )
        assert article.spotify_url == "https://open.spotify.com/episode/abc"

    def test_calls_save(self) -> None:
        article = _make_article()
        repo = _mock_repo(article)
        UpdateArticle(repo).execute(article_id=article.id, title="Titolo")
        repo.save.assert_called_once_with(article)

    def test_raises_not_found(self) -> None:
        repo = _mock_repo(None)
        with pytest.raises(ArticleNotFoundError):
            UpdateArticle(repo).execute(article_id=uuid.uuid4(), title="X")
