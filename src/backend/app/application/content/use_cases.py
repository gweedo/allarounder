import uuid
from datetime import UTC, datetime

from app.domain.content.entities import Article
from app.domain.content.repositories import ArticleRepository
from app.domain.content.value_objects import Body, PublicationStatus, Slug


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
    ) -> Article:
        now = datetime.now(tz=UTC)
        article = Article(
            id=uuid.uuid4(),
            title=title,
            slug=Slug.from_title(title),
            body=Body(body),
            status=PublicationStatus.draft,
            author_id=author_id,
            created_at=now,
            updated_at=now,
            publish_at=publish_at,
        )
        self._repo.add(article)
        return article
