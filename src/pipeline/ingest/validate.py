"""Row validation against the domain layer (CONTENT-CONTRACT.md §5).

A failing row raises `RowValidationError` carrying the exact Italian message
that goes into `esito` (CONTENT-CONTRACT.md §7) -- never a generic exception,
so a non-technical writer can act on it without asking an engineer.
"""

from __future__ import annotations

from dataclasses import dataclass

from domain.content.value_objects import (
    META_DESCRIPTION_MAX_LENGTH,
    META_DESCRIPTION_MIN_LENGTH,
    MetaDescription,
    Slug,
    SpotifyUrl,
)
from ingest.models import SheetRow
from ingest.registries import Profile, match_author, match_or_create_guest, split_names

CATEGORIES: dict[str, str] = {
    "Interviste": "cat-interviste",
    "Analisi": "cat-analisi",
    "Roundtable": "cat-roundtable",
    "Out of the Box": "cat-out-of-the-box",
}


class RowValidationError(Exception):
    """Carries the exact Italian `esito` failure message."""


@dataclass(frozen=True)
class ValidatedRow:
    titolo: str
    category_id: str
    category_name: str
    category_slug: str
    author: Profile
    guests: list[Profile]
    tags: list[str]
    spotify_url: str | None
    meta_description: str
    cover_image_ref: str | None


def validate_row(
    row: SheetRow,
    body_markdown: str,
    authors: list[Profile],
    guests_registry: list[Profile],
) -> ValidatedRow:
    titolo = row.titolo.strip()
    if not titolo:
        raise RowValidationError("titolo mancante")

    if not body_markdown.strip():
        raise RowValidationError("il documento collegato è vuoto")

    # Deliberately exact -- not .strip()'d: "Interviste " (trailing space) must
    # be rejected with a message that tells the writer to check for stray
    # whitespace, per CONTENT-CONTRACT.md §7's own example.
    categoria = row.categoria
    if categoria not in CATEGORIES:
        raise RowValidationError(
            f'categoria "{row.categoria}" non riconosciuta — controlla spazi o refusi'
        )

    author = match_author(row.autore, authors)
    if author is None:
        raise RowValidationError(
            f'autore "{row.autore}" non riconosciuto — controlla il nome o '
            "chiedi a Guido di aggiungerlo"
        )

    guest_names = split_names(row.ospite)
    resolved_guests = [match_or_create_guest(name, guests_registry) for name in guest_names]

    spotify_url: str | None = None
    spotify_cell = row.spotify.strip()
    if spotify_cell:
        try:
            spotify_url = str(SpotifyUrl(spotify_cell))
        except ValueError as exc:
            raise RowValidationError("collegamento Spotify non valido") from exc

    meta_description = row.meta_description.strip()
    try:
        MetaDescription(meta_description)
    except ValueError:
        length = len(meta_description)
        troppo = "corta" if length < META_DESCRIPTION_MIN_LENGTH else "lunga"
        raise RowValidationError(
            f"meta description troppo {troppo} ({length}, servono "
            f"{META_DESCRIPTION_MIN_LENGTH}–{META_DESCRIPTION_MAX_LENGTH})"
        ) from None

    return ValidatedRow(
        titolo=titolo,
        category_id=CATEGORIES[categoria],
        category_name=categoria,
        category_slug=str(Slug.from_title(categoria)),
        author=author,
        guests=resolved_guests,
        tags=split_names(row.tag),
        spotify_url=spotify_url,
        meta_description=meta_description,
        cover_image_ref=row.copertina.strip() or None,
    )
