"""Domain unit tests for Article aggregate and content value objects."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.content.entities import Article
from app.domain.content.exceptions import SlugLockedError
from app.domain.content.value_objects import Body, PublicationStatus, Slug


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_article(**kwargs: object) -> Article:
    now = _now()
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "title": "Come Allenarsi d'Estate",
        "slug": Slug("come-allenarsi-d-estate"),
        "body": Body(""),
        "status": PublicationStatus.draft,
        "author_id": uuid.uuid4(),
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(kwargs)
    return Article(**defaults)  # type: ignore[arg-type]


class TestSlugGeneration:
    def test_generates_from_plain_title(self) -> None:
        assert Slug.from_title("Come Allenarsi").value == "come-allenarsi"

    def test_strips_grave_accent_e(self) -> None:
        assert Slug.from_title("Caffè al Bar").value == "caffe-al-bar"

    def test_strips_grave_accent_u(self) -> None:
        assert Slug.from_title("Più forte").value == "piu-forte"

    def test_strips_acute_accent(self) -> None:
        assert Slug.from_title("Perché correre").value == "perche-correre"

    def test_strips_grave_accent_a(self) -> None:
        assert Slug.from_title("Andrà meglio").value == "andra-meglio"

    def test_strips_special_chars(self) -> None:
        assert Slug.from_title("Ciao! Mondo?").value == "ciao-mondo"

    def test_collapses_multiple_separators(self) -> None:
        assert Slug.from_title("A  B   C").value == "a-b-c"

    def test_strips_leading_trailing_hyphens(self) -> None:
        assert Slug.from_title("--hello--").value == "hello"

    def test_numbers_preserved(self) -> None:
        assert Slug.from_title("Top 10 consigli").value == "top-10-consigli"


class TestSlugValidation:
    def test_manual_slug_accepted(self) -> None:
        s = Slug("my-custom-slug")
        assert s.value == "my-custom-slug"

    def test_alphanumeric_only_accepted(self) -> None:
        s = Slug("slug123")
        assert s.value == "slug123"

    def test_uppercase_raises(self) -> None:
        with pytest.raises(ValueError):
            Slug("InvalidSlug")

    def test_spaces_raise(self) -> None:
        with pytest.raises(ValueError):
            Slug("ciao mondo")

    def test_empty_raises(self) -> None:
        with pytest.raises(ValueError):
            Slug("")

    def test_leading_hyphen_raises(self) -> None:
        with pytest.raises(ValueError):
            Slug("-bad-slug")

    def test_trailing_hyphen_raises(self) -> None:
        with pytest.raises(ValueError):
            Slug("bad-slug-")


class TestSlugMutability:
    def test_slug_can_be_changed_before_publish(self) -> None:
        article = _make_article()
        new_slug = Slug("nuova-slug")
        article.set_slug(new_slug)
        assert article.slug == new_slug

    def test_slug_locked_after_publish(self) -> None:
        article = _make_article()
        article.publish(_now())
        with pytest.raises(SlugLockedError):
            article.set_slug(Slug("altra-slug"))

    def test_slug_locked_permanently_after_publish_then_archive(self) -> None:
        article = _make_article()
        article.publish(_now())
        article.archive(_now())
        with pytest.raises(SlugLockedError):
            article.set_slug(Slug("new-slug"))

    def test_slug_can_change_on_archived_article(self) -> None:
        article = _make_article()
        article.archive(_now())
        new_slug = Slug("slug-archiviato")
        article.set_slug(new_slug)
        assert article.slug == new_slug


class TestArticleLifecycle:
    def test_new_article_is_draft(self) -> None:
        article = _make_article()
        assert article.status == PublicationStatus.draft

    def test_publish_sets_status_published(self) -> None:
        article = _make_article()
        article.publish(_now())
        assert article.status == PublicationStatus.published

    def test_publish_sets_publish_at_when_not_set(self) -> None:
        article = _make_article()
        now = _now()
        article.publish(now)
        assert article.publish_at == now

    def test_publish_preserves_existing_publish_at(self) -> None:
        scheduled = _now() + timedelta(days=1)
        article = _make_article(publish_at=scheduled)
        article.publish(_now())
        assert article.publish_at == scheduled

    def test_archive_sets_status_archived(self) -> None:
        article = _make_article()
        article.archive(_now())
        assert article.status == PublicationStatus.archived

    def test_publish_clears_preview_token(self) -> None:
        article = _make_article()
        article.preview_token = uuid.uuid4()
        article.publish(_now())
        assert article.preview_token is None
