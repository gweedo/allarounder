"""Orchestrates one pipeline run end-to-end against CONTENT-CONTRACT.md.

Re-evaluates the entire Sheet every run (§3, §8) rather than only the row
named in a `repository_dispatch` payload, so the nightly cron and the
dispatch-triggered run share identical logic.
"""

from __future__ import annotations

import sys
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from domain.content.value_objects import Body, Slug
from ingest import content_writer, images, registries
from ingest.convert import html_to_markdown, rewrite_image_links
from ingest.drive_client import DriveClient, extract_doc_id
from ingest.esito import format_failure, format_scheduled, format_success, should_update
from ingest.identity import SlugCollisionError, resolve_identity
from ingest.models import (
    ArticleMeta,
    ExtractedImage,
    GeneratedArticle,
    SheetRow,
    SlugRef,
)
from ingest.publish_rule import Eligibility, evaluate, publish_at_utc
from ingest.registries import Profile
from ingest.sheets_client import SheetsClient
from ingest.validate import RowValidationError, validate_row


@dataclass
class RowOutcome:
    row_number: int
    esito: str


@dataclass
class RunReport:
    outcomes: list[RowOutcome] = field(default_factory=list)


def _failure_message(exc: Exception) -> str:
    """`RowValidationError`/`SlugCollisionError` already carry a specific,
    Italian, writer-actionable message (CONTENT-CONTRACT.md §7) -- pass those
    through verbatim. Anything else is an unexpected failure (a Drive API
    error, a malformed export zip, an image I/O error, ...) whose `str()`
    might be in English or expose internals neither of which a non-technical
    writer can act on, so it gets a generic, safe Italian message instead."""
    if isinstance(exc, (RowValidationError, SlugCollisionError)):
        return str(exc)
    return "errore imprevisto durante l'importazione — controlla i log della pipeline"


def run(
    sheets: SheetsClient,
    drive: DriveClient,
    content_dir: Path,
    public_dir: Path,
    authors_path: Path,
    guests_path: Path,
    now: datetime,
) -> RunReport:
    index = content_writer.load_index(content_dir)
    authors = registries.load_registry(authors_path)
    guests_registry = registries.load_registry(guests_path)

    report = RunReport()
    # (row_number, current esito, new esito) -- the Sheet write is deferred
    # until *after* `save_index()` below succeeds, so a crash partway through
    # this loop can never leave the Sheet claiming success for a row whose
    # content was never actually saved.
    pending: list[tuple[int, str, str]] = []

    for row in sheets.read_rows():
        try:
            eligibility = evaluate(row.stato, row.data, now)
        except ValueError:
            message = format_failure(f'data "{row.data}" non valida — usa il formato AAAA-MM-GG')
            pending.append((row.row_number, row.esito, message))
            continue

        if eligibility is Eligibility.NOT_PUBLISHABLE:
            continue

        if eligibility is Eligibility.SCHEDULED:
            message = format_scheduled(row.data)
        else:
            try:
                message = _publish_row(
                    row, drive, content_dir, public_dir, index, authors, guests_registry, now
                )
            except Exception as exc:  # noqa: BLE001 -- one bad row must degrade
                # to a failed esito, never abort the whole run (a Drive API
                # error, a malformed export zip, or an image I/O failure on
                # row N must not also cost rows N+1..last their publish). The
                # Sheet only ever gets a safe, generic Italian message
                # (_failure_message) -- the real exception goes to the
                # Actions log, which is exactly what that message tells a
                # human to go check.
                print(f"row {row.row_number}: unexpected error while publishing", file=sys.stderr)
                traceback.print_exc()
                message = format_failure(_failure_message(exc))

        pending.append((row.row_number, row.esito, message))

    content_writer.save_index(content_dir, index)

    for row_number, current_esito, message in pending:
        if should_update(current_esito, message):
            sheets.write_esito(row_number, message)
            report.outcomes.append(RowOutcome(row_number, message))

    return report


def _publish_row(
    row: SheetRow,
    drive: DriveClient,
    content_dir: Path,
    public_dir: Path,
    index: dict[str, Any],
    authors: list[Profile],
    guests_registry: list[Profile],
    now: datetime,
) -> str:
    """Returns the success esito message. Raises `RowValidationError` or
    `SlugCollisionError` on a rejected row; any other exception signals an
    unexpected failure (Drive/network/image errors) that the caller must
    treat as a per-row failure, never let escape and abort the whole run."""
    doc_id = extract_doc_id(row.doc)
    current_modified = drive.get_modified_time(doc_id)

    existing = content_writer.find_article_by_doc_id(index["articles"], doc_id)
    if (
        existing is not None
        and existing.get("updated_at") == current_modified
        and row.esito.strip().startswith("✓")
    ):
        # The Doc hasn't changed since it last published successfully, and
        # the Sheet already shows that success -- skip the expensive
        # re-export/re-convert/re-download entirely and reuse the existing
        # esito verbatim (never fabricate a new "publish time" for content
        # that wasn't actually just published -- that's what a modifiedTime-
        # based timestamp would do, and it lies for a scheduled post whose
        # Doc was last edited long before its real publish moment). Without
        # this skip, CONTENT-CONTRACT.md §3's "re-evaluate the entire Sheet
        # every run" rule would force a full reprocess of every published
        # article, forever, on every nightly cron run. Sheet-only field edits
        # (titolo, meta_description, tags, ...) made without touching the Doc
        # itself are not picked up until the Doc changes -- an accepted
        # trade-off for keeping the recurring cost bounded (CONTENT-CONTRACT.md §3).
        return row.esito.strip()

    export = drive.export_doc(doc_id)
    markdown = html_to_markdown(export.html)

    validated = validate_row(row, markdown, authors, guests_registry)
    identity = resolve_identity(doc_id, validated.titolo, index["articles"])

    cover_url: str | None = None
    cover_alt: str | None = None
    if validated.cover_image_ref:
        cover_bytes = drive.download_file(validated.cover_image_ref)
        cover_name = drive.get_file_name(validated.cover_image_ref)
        cover_image = ExtractedImage(filename=cover_name, data=cover_bytes)
        cover_url = images.write_cover_image(public_dir, identity.slug, cover_image)
        cover_alt = validated.titolo

    image_mapping = images.write_inline_images(public_dir, identity.slug, export.images)
    body = rewrite_image_links(markdown, image_mapping)

    category_ref = SlugRef(
        id=validated.category_id, name=validated.category_name, slug=validated.category_slug
    )
    author_ref = SlugRef(
        id=f"author-{validated.author.slug}", name=validated.author.name, slug=validated.author.slug
    )
    tag_slugs = [str(Slug.from_title(tag)) for tag in validated.tags]
    tag_refs = [
        SlugRef(id=f"tag-{slug}", name=tag, slug=slug)
        for tag, slug in zip(validated.tags, tag_slugs, strict=True)
    ]
    guest_refs = [
        SlugRef(id=f"guest-{g.slug}", name=g.name, slug=g.slug) for g in validated.guests
    ]

    reading_time = Body(body).reading_time_minutes()
    updated_at = current_modified
    publish_at = publish_at_utc(row.data).isoformat().replace("+00:00", "Z")

    meta = ArticleMeta(
        id=identity.id,
        doc_id=doc_id,
        title=validated.titolo,
        slug=identity.slug,
        author_id=author_ref.id,
        publish_at=publish_at,
        updated_at=updated_at,
        spotify_url=validated.spotify_url,
        excerpt=validated.meta_description,
        cover_image_url=cover_url,
        cover_image_alt=cover_alt,
        meta_title=f"{validated.titolo} — Allarounder",
        meta_description=validated.meta_description,
        og_image_url=cover_url,
        reading_time=reading_time,
        author_profile=author_ref,
        category=category_ref,
        tags=tag_refs,
        guests=guest_refs,
    )

    content_writer.write_article_file(content_dir, GeneratedArticle(meta=meta, body=body))
    content_writer.upsert_article(index, meta)
    content_writer.upsert_category(index, category_ref)
    content_writer.upsert_author(
        index, author_ref, validated.author.bio, validated.author.photo_url, validated.author.links
    )
    for tag_ref in tag_refs:
        content_writer.upsert_tag(index, tag_ref)
    for guest_ref, guest_profile in zip(guest_refs, validated.guests, strict=True):
        content_writer.upsert_guest(
            index, guest_ref, guest_profile.bio, guest_profile.photo_url, guest_profile.links
        )

    return format_success(now)
