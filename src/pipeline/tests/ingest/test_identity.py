import pytest

from ingest.identity import SlugCollisionError, resolve_identity


class TestResolveIdentity:
    def test_first_publish_derives_slug_from_title(self) -> None:
        identity = resolve_identity("doc-1", "Intervista a Marco", [])
        assert identity.slug == "intervista-a-marco"
        assert identity.id == "article-intervista-a-marco"
        assert identity.is_new is True

    def test_known_doc_id_reuses_locked_slug_even_if_title_changed(self) -> None:
        existing = [{"id": "article-intervista-a-marco", "slug": "intervista-a-marco", "doc_id": "doc-1"}]
        identity = resolve_identity("doc-1", "Titolo completamente diverso", existing)
        assert identity.slug == "intervista-a-marco"
        assert identity.id == "article-intervista-a-marco"
        assert identity.is_new is False

    def test_new_doc_colliding_with_different_docs_slug_raises(self) -> None:
        existing = [{"id": "article-intervista-a-marco", "slug": "intervista-a-marco", "doc_id": "doc-1"}]
        with pytest.raises(SlugCollisionError):
            resolve_identity("doc-2", "Intervista a Marco", existing)

    def test_same_doc_id_does_not_collide_with_itself(self) -> None:
        existing = [{"id": "article-intervista-a-marco", "slug": "intervista-a-marco", "doc_id": "doc-1"}]
        identity = resolve_identity("doc-1", "Intervista a Marco", existing)
        assert identity.is_new is False
