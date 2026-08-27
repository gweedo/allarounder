"""Shared data shapes for the ingest pipeline (CONTENT-CONTRACT.md)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SheetRow:
    """One row of the editorial Sheet, read verbatim (CONTENT-CONTRACT.md §1)."""

    row_number: int
    titolo: str
    doc: str
    categoria: str
    tag: str
    autore: str
    ospite: str
    spotify: str
    copertina: str
    meta_description: str
    data: str
    stato: str
    esito: str


@dataclass(frozen=True)
class SlugRef:
    id: str
    name: str
    slug: str


@dataclass(frozen=True)
class ExtractedImage:
    filename: str
    data: bytes


@dataclass(frozen=True)
class DocExport:
    html: str
    images: list[ExtractedImage] = field(default_factory=list)


@dataclass(frozen=True)
class ArticleMeta:
    """Mirrors `ArticleMeta` in `src/frontend/lib/content.ts`, plus the
    pipeline-only `doc_id` field (CONTENT-CONTRACT.md §2, §9)."""

    id: str
    doc_id: str
    title: str
    slug: str
    author_id: str
    publish_at: str
    updated_at: str
    spotify_url: str | None
    excerpt: str | None
    cover_image_url: str | None
    cover_image_alt: str | None
    meta_title: str | None
    meta_description: str | None
    og_image_url: str | None
    reading_time: int | None
    author_profile: SlugRef | None
    category: SlugRef | None
    tags: list[SlugRef]
    guests: list[SlugRef]


@dataclass(frozen=True)
class GeneratedArticle:
    meta: ArticleMeta
    body: str
