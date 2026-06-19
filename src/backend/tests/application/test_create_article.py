"""Application layer tests for CreateArticle use case — no I/O."""

import uuid
from datetime import UTC, datetime

from app.application.content.use_cases import CreateArticle
from app.domain.content.entities import Article
from app.domain.content.value_objects import PublicationStatus


class InMemoryArticleRepo:
    def __init__(self) -> None:
        self._articles: dict[uuid.UUID, Article] = {}

    def add(self, article: Article) -> None:
        self._articles[article.id] = article

    def get_by_id(self, article_id: uuid.UUID) -> Article | None:
        return self._articles.get(article_id)

    def list(
        self,
        *,
        author_id: uuid.UUID | None = None,
        status: object = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Article], int]:
        items = list(self._articles.values())
        if author_id is not None:
            items = [a for a in items if a.author_id == author_id]
        if status is not None:
            items = [a for a in items if a.status == status]
        return items[(page - 1) * page_size : page * page_size], len(items)


class TestCreateArticle:
    def _repo(self) -> InMemoryArticleRepo:
        return InMemoryArticleRepo()

    def test_creates_draft(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(title="Il mio articolo", author_id=uuid.uuid4())
        assert article.status == PublicationStatus.draft

    def test_auto_generates_slug(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(title="Il mio primo articolo", author_id=uuid.uuid4())
        assert article.slug.value == "il-mio-primo-articolo"

    def test_slug_strips_italian_accents(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(title="Caffè e Più", author_id=uuid.uuid4())
        assert article.slug.value == "caffe-e-piu"

    def test_article_is_persisted(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(title="Articolo test", author_id=uuid.uuid4())
        assert repo.get_by_id(article.id) is not None

    def test_author_id_is_set(self) -> None:
        repo = self._repo()
        author_id = uuid.uuid4()
        article = CreateArticle(repo).execute(title="Articolo", author_id=author_id)
        assert article.author_id == author_id

    def test_empty_body_by_default(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(title="Articolo", author_id=uuid.uuid4())
        assert article.body.value == ""

    def test_custom_body_stored(self) -> None:
        repo = self._repo()
        article = CreateArticle(repo).execute(
            title="Articolo", author_id=uuid.uuid4(), body="# Titolo\n\nTesto."
        )
        assert article.body.value == "# Titolo\n\nTesto."

    def test_created_at_is_recent(self) -> None:
        repo = self._repo()
        before = datetime.now(tz=UTC)
        article = CreateArticle(repo).execute(title="Articolo", author_id=uuid.uuid4())
        assert article.created_at >= before
