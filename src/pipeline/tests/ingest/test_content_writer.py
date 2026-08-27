import json
from pathlib import Path

from ingest import content_writer
from ingest.models import ArticleMeta, GeneratedArticle, SlugRef


def _meta(**overrides: object) -> ArticleMeta:
    defaults: dict[str, object] = {
        "id": "article-intervista-a-marco",
        "doc_id": "doc-1",
        "title": "Intervista a Marco",
        "slug": "intervista-a-marco",
        "author_id": "author-guido-s",
        "publish_at": "2026-08-27T00:00:00Z",
        "updated_at": "2026-08-27T00:00:00Z",
        "spotify_url": None,
        "excerpt": "Descrizione.",
        "cover_image_url": None,
        "cover_image_alt": None,
        "meta_title": "Intervista a Marco — Allarounder",
        "meta_description": "Descrizione.",
        "og_image_url": None,
        "reading_time": 3,
        "author_profile": SlugRef(id="author-guido-s", name="Guido S.", slug="guido-s"),
        "category": SlugRef(id="cat-interviste", name="Interviste", slug="interviste"),
        "tags": [SlugRef(id="tag-mondiali", name="Mondiali", slug="mondiali")],
        "guests": [SlugRef(id="guest-marco-bianchi", name="Marco Bianchi", slug="marco-bianchi")],
    }
    defaults.update(overrides)
    return ArticleMeta(**defaults)  # type: ignore[arg-type]


class TestLoadIndex:
    def test_missing_file_returns_empty_shape(self, tmp_path: Path) -> None:
        index = content_writer.load_index(tmp_path)
        assert index == {"articles": [], "categories": [], "authors": [], "guests": [], "tags": []}

    def test_loads_existing_file(self, tmp_path: Path) -> None:
        (tmp_path / "index.json").write_text(json.dumps({"articles": [{"id": "x"}]}), encoding="utf-8")
        index = content_writer.load_index(tmp_path)
        assert index["articles"] == [{"id": "x"}]
        assert index["tags"] == []


class TestSaveIndex:
    def test_round_trips(self, tmp_path: Path) -> None:
        index = {"articles": [{"id": "a"}], "categories": [], "authors": [], "guests": [], "tags": []}
        content_writer.save_index(tmp_path, index)
        assert content_writer.load_index(tmp_path) == index


class TestWriteArticleFile:
    def test_writes_frontmatter_and_body(self, tmp_path: Path) -> None:
        article = GeneratedArticle(meta=_meta(), body="Corpo dell'articolo.")
        content_writer.write_article_file(tmp_path, article)
        text = (tmp_path / "articles" / "intervista-a-marco.md").read_text(encoding="utf-8")
        assert text.startswith("---\n")
        assert "doc_id: doc-1" in text
        assert text.rstrip().endswith("Corpo dell'articolo.")


class TestUpsertArticle:
    def test_appends_new_article(self) -> None:
        index: dict[str, list[object]] = {"articles": [], "categories": [], "authors": [], "guests": [], "tags": []}
        content_writer.upsert_article(index, _meta())
        assert len(index["articles"]) == 1

    def test_replaces_existing_article_with_same_id(self) -> None:
        index: dict[str, list[object]] = {"articles": [], "categories": [], "authors": [], "guests": [], "tags": []}
        content_writer.upsert_article(index, _meta())
        content_writer.upsert_article(index, _meta(title="Titolo aggiornato"))
        assert len(index["articles"]) == 1
        assert index["articles"][0]["title"] == "Titolo aggiornato"  # type: ignore[index]


class TestUpsertCategory:
    def test_adds_once(self) -> None:
        index: dict[str, list[object]] = {"categories": []}
        ref = SlugRef(id="cat-interviste", name="Interviste", slug="interviste")
        content_writer.upsert_category(index, ref)
        content_writer.upsert_category(index, ref)
        assert len(index["categories"]) == 1


class TestUpsertAuthorAndGuest:
    def test_author_adds_profile_fields(self) -> None:
        index: dict[str, list[object]] = {"authors": []}
        ref = SlugRef(id="author-guido-s", name="Guido S.", slug="guido-s")
        content_writer.upsert_author(index, ref, "bio", None, {})
        assert index["authors"][0]["bio"] == "bio"  # type: ignore[index]

    def test_guest_does_not_duplicate(self) -> None:
        index: dict[str, list[object]] = {"guests": []}
        ref = SlugRef(id="guest-marco", name="Marco", slug="marco")
        content_writer.upsert_guest(index, ref, None, None, {})
        content_writer.upsert_guest(index, ref, None, None, {})
        assert len(index["guests"]) == 1


class TestUpsertTag:
    def test_does_not_duplicate(self) -> None:
        index: dict[str, list[object]] = {"tags": []}
        ref = SlugRef(id="tag-mondiali", name="Mondiali", slug="mondiali")
        content_writer.upsert_tag(index, ref)
        content_writer.upsert_tag(index, ref)
        assert len(index["tags"]) == 1
