import uuid
from typing import Protocol

from app.domain.content.entities import Article
from app.domain.content.value_objects import PublicationStatus


class ArticleRepository(Protocol):
    def add(self, article: Article) -> None: ...
    def get_by_id(self, article_id: uuid.UUID) -> Article | None: ...
    def list(
        self,
        *,
        author_id: uuid.UUID | None = None,
        status: PublicationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Article], int]: ...
