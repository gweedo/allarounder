"""Application layer tests for tag use cases — no I/O."""

import uuid

import pytest

from app.application.content.use_cases import DeleteTag, RenameTag, TagNotFoundError
from app.domain.content.entities import Tag
from app.domain.content.value_objects import Slug


class InMemoryTagRepo:
    def __init__(self) -> None:
        self._tags: dict[uuid.UUID, Tag] = {}

    def add(self, tag: Tag) -> None:
        self._tags[tag.id] = tag

    def get_by_id(self, tag_id: uuid.UUID) -> Tag | None:
        return self._tags.get(tag_id)

    def save(self, tag: Tag) -> None:
        self._tags[tag.id] = tag

    def delete(self, tag_id: uuid.UUID) -> None:
        self._tags.pop(tag_id, None)


class TestRenameTag:
    def _repo_with_tag(
        self, name: str = "calcio", slug: str = "calcio"
    ) -> tuple[InMemoryTagRepo, Tag]:
        repo = InMemoryTagRepo()
        tag = Tag(id=uuid.uuid4(), name=name, slug=Slug(slug))
        repo.add(tag)
        return repo, tag

    def test_renames_tag(self) -> None:
        repo, tag = self._repo_with_tag()
        renamed = RenameTag(repo).execute(tag_id=tag.id, name="pallone")
        assert renamed.name == "pallone"

    def test_persists_rename(self) -> None:
        repo, tag = self._repo_with_tag()
        RenameTag(repo).execute(tag_id=tag.id, name="pallone")
        assert repo.get_by_id(tag.id).name == "pallone"

    def test_slug_stays_stable_on_rename(self) -> None:
        # Slug is not re-derived on rename: existing /tags/<slug> URLs must keep
        # working, matching the established UpdateCategory behavior.
        repo, tag = self._repo_with_tag(name="calcio", slug="calcio")
        renamed = RenameTag(repo).execute(tag_id=tag.id, name="Calcio e dintorni")
        assert renamed.slug.value == "calcio"

    def test_raises_when_tag_not_found(self) -> None:
        repo = InMemoryTagRepo()
        with pytest.raises(TagNotFoundError):
            RenameTag(repo).execute(tag_id=uuid.uuid4(), name="pallone")


class TestDeleteTag:
    def test_deletes_existing_tag(self) -> None:
        repo = InMemoryTagRepo()
        tag = Tag(id=uuid.uuid4(), name="calcio", slug=Slug("calcio"))
        repo.add(tag)
        DeleteTag(repo).execute(tag_id=tag.id)
        assert repo.get_by_id(tag.id) is None

    def test_raises_when_tag_not_found(self) -> None:
        repo = InMemoryTagRepo()
        with pytest.raises(TagNotFoundError):
            DeleteTag(repo).execute(tag_id=uuid.uuid4())
