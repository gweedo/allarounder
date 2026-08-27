"""Reads/writes generated content: index.json, articles/<slug>.md
(CONTENT-CONTRACT.md §6, §9).

Authoritative shape: `src/frontend/lib/content.ts`. `doc_id` is an extra
frontmatter/index field the pipeline uses for identity (CONTENT-CONTRACT.md
§2) that `content.ts`'s `ArticleMeta` interface doesn't type -- harmless,
since `content.ts` reads frontmatter via a type assertion, not runtime
validation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from ingest.models import ArticleMeta, GeneratedArticle, SlugRef

_INDEX_KEYS = ("articles", "categories", "authors", "guests", "tags")


def load_index(content_dir: Path) -> dict[str, Any]:
    index_path = content_dir / "index.json"
    if not index_path.exists():
        return {key: [] for key in _INDEX_KEYS}
    data = dict(json.loads(index_path.read_text(encoding="utf-8")))
    for key in _INDEX_KEYS:
        data.setdefault(key, [])
    return data


def save_index(content_dir: Path, index: dict[str, Any]) -> None:
    content_dir.mkdir(parents=True, exist_ok=True)
    index_path = content_dir / "index.json"
    index_path.write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _slug_ref_dict(ref: SlugRef) -> dict[str, str]:
    return {"id": ref.id, "name": ref.name, "slug": ref.slug}


def article_meta_dict(meta: ArticleMeta) -> dict[str, Any]:
    return {
        "id": meta.id,
        "doc_id": meta.doc_id,
        "title": meta.title,
        "slug": meta.slug,
        "author_id": meta.author_id,
        "publish_at": meta.publish_at,
        "updated_at": meta.updated_at,
        "spotify_url": meta.spotify_url,
        "excerpt": meta.excerpt,
        "cover_image_url": meta.cover_image_url,
        "cover_image_alt": meta.cover_image_alt,
        "meta_title": meta.meta_title,
        "meta_description": meta.meta_description,
        "og_image_url": meta.og_image_url,
        "reading_time": meta.reading_time,
        "author_profile": _slug_ref_dict(meta.author_profile) if meta.author_profile else None,
        "category": _slug_ref_dict(meta.category) if meta.category else None,
        "tags": [_slug_ref_dict(t) for t in meta.tags],
        "guests": [_slug_ref_dict(g) for g in meta.guests],
    }


def write_article_file(content_dir: Path, article: GeneratedArticle) -> None:
    articles_dir = content_dir / "articles"
    articles_dir.mkdir(parents=True, exist_ok=True)
    frontmatter = yaml.safe_dump(
        article_meta_dict(article.meta), allow_unicode=True, sort_keys=False
    )
    text = f"---\n{frontmatter}---\n{article.body.strip()}\n"
    (articles_dir / f"{article.meta.slug}.md").write_text(text, encoding="utf-8")


def upsert_article(index: dict[str, Any], meta: ArticleMeta) -> None:
    entry = article_meta_dict(meta)
    articles: list[dict[str, Any]] = index["articles"]
    for i, existing in enumerate(articles):
        if existing["id"] == meta.id:
            articles[i] = entry
            return
    articles.append(entry)


def upsert_ref(collection: list[dict[str, Any]], ref: SlugRef) -> None:
    for existing in collection:
        if existing["id"] == ref.id:
            return
    collection.append(_slug_ref_dict(ref))


def upsert_category(index: dict[str, Any], ref: SlugRef, description: str | None = None) -> None:
    for existing in index["categories"]:
        if existing["id"] == ref.id:
            return
    index["categories"].append({**_slug_ref_dict(ref), "description": description})


def _upsert_profile(
    collection: list[dict[str, Any]],
    ref: SlugRef,
    bio: str | None,
    photo_url: str | None,
    links: dict[str, str],
) -> None:
    for existing in collection:
        if existing["id"] == ref.id:
            return
    collection.append({**_slug_ref_dict(ref), "bio": bio, "photo_url": photo_url, "links": links})


def upsert_author(
    index: dict[str, Any], ref: SlugRef, bio: str | None, photo_url: str | None, links: dict[str, str]
) -> None:
    _upsert_profile(index["authors"], ref, bio, photo_url, links)


def upsert_guest(
    index: dict[str, Any], ref: SlugRef, bio: str | None, photo_url: str | None, links: dict[str, str]
) -> None:
    _upsert_profile(index["guests"], ref, bio, photo_url, links)


def upsert_tag(index: dict[str, Any], ref: SlugRef) -> None:
    upsert_ref(index["tags"], ref)
