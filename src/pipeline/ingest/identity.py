"""Article identity and slug locking (CONTENT-CONTRACT.md §2).

The Doc is an article's stable identity, not its title -- this reconstructs
`Article.slug_locked` behaviour across pipeline runs that have no database to
hold that flag between them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from domain.content.value_objects import Slug
from ingest.content_writer import find_article_by_doc_id


class SlugCollisionError(Exception):
    """A freshly-derived slug collides with a different Doc's existing slug."""


@dataclass(frozen=True)
class ArticleIdentity:
    id: str
    slug: str
    is_new: bool


def resolve_identity(
    doc_id: str,
    titolo: str,
    existing_articles: list[dict[str, Any]],
) -> ArticleIdentity:
    """`existing_articles` is the current `content/index.json` "articles"
    list (plain dicts, as read from JSON -- CONTENT-CONTRACT.md §9)."""
    existing = find_article_by_doc_id(existing_articles, doc_id)
    if existing is not None:
        return ArticleIdentity(id=existing["id"], slug=existing["slug"], is_new=False)

    slug = str(Slug.from_title(titolo))
    for article in existing_articles:
        if article["slug"] == slug and article.get("doc_id") != doc_id:
            raise SlugCollisionError(
                f'lo slug "{slug}" è già usato da un altro articolo (documento diverso) '
                "-- cambia titolo"
            )
    return ArticleIdentity(id=f"article-{slug}", slug=slug, is_new=True)
