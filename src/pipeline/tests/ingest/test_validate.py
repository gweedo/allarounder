import pytest

from ingest.models import SheetRow
from ingest.registries import Profile
from ingest.validate import RowValidationError, validate_row

AUTHORS = [Profile(slug="guido-s", name="Guido S.")]
GUESTS: list[Profile] = []

VALID_META_DESCRIPTION = (
    "Una chiacchierata approfondita su obiettivi, avversarie e percorso "
    "verso i Mondiali di ginnastica artistica, con dettagli sulla preparazione."
)
assert 140 <= len(VALID_META_DESCRIPTION) <= 155


def _row(**overrides: str) -> SheetRow:
    defaults = {
        "row_number": 2,
        "titolo": "Intervista a Marco",
        "doc": "https://docs.google.com/document/d/abc123/edit",
        "categoria": "Interviste",
        "tag": "Mondiali, Esordienti",
        "autore": "Guido S.",
        "ospite": "Marco Bianchi",
        "spotify": "https://open.spotify.com/episode/abc123",
        "copertina": "",
        "meta_description": VALID_META_DESCRIPTION,
        "data": "2026-08-27",
        "stato": "Pubblicato",
        "esito": "",
    }
    defaults.update(overrides)
    return SheetRow(**defaults)  # type: ignore[arg-type]


class TestValidateRow:
    def test_valid_row_passes(self) -> None:
        result = validate_row(_row(), "Corpo dell'articolo.", AUTHORS, GUESTS)
        assert result.titolo == "Intervista a Marco"
        assert result.category_id == "cat-interviste"
        assert result.author.slug == "guido-s"
        assert result.guests[0].name == "Marco Bianchi"
        assert result.tags == ["Mondiali", "Esordienti"]
        assert result.spotify_url == "https://open.spotify.com/episode/abc123"

    def test_rejects_empty_title(self) -> None:
        with pytest.raises(RowValidationError, match="titolo mancante"):
            validate_row(_row(titolo="  "), "Corpo.", AUTHORS, GUESTS)

    def test_rejects_empty_body(self) -> None:
        with pytest.raises(RowValidationError, match="documento collegato è vuoto"):
            validate_row(_row(), "   ", AUTHORS, GUESTS)

    def test_rejects_unknown_category(self) -> None:
        with pytest.raises(RowValidationError, match="non riconosciuta"):
            validate_row(_row(categoria="Interviste "), "Corpo.", AUTHORS, GUESTS)

    def test_rejects_unknown_author(self) -> None:
        with pytest.raises(RowValidationError, match="non riconosciuto"):
            validate_row(_row(autore="Marco"), "Corpo.", AUTHORS, GUESTS)

    def test_creates_minimal_guest_when_unmatched(self) -> None:
        result = validate_row(_row(ospite="Ginnasta Nuova"), "Corpo.", AUTHORS, GUESTS)
        assert result.guests[0].name == "Ginnasta Nuova"
        assert result.guests[0].bio is None

    def test_empty_ospite_produces_no_guests(self) -> None:
        result = validate_row(_row(ospite=""), "Corpo.", AUTHORS, GUESTS)
        assert result.guests == []

    def test_rejects_invalid_spotify_url(self) -> None:
        with pytest.raises(RowValidationError, match="collegamento Spotify non valido"):
            validate_row(_row(spotify="https://music.apple.com/x"), "Corpo.", AUTHORS, GUESTS)

    def test_empty_spotify_is_valid(self) -> None:
        result = validate_row(_row(spotify=""), "Corpo.", AUTHORS, GUESTS)
        assert result.spotify_url is None

    def test_rejects_meta_description_too_short(self) -> None:
        with pytest.raises(RowValidationError, match=r"troppo corta \(10, servono 140–155\)"):
            validate_row(_row(meta_description="a" * 10), "Corpo.", AUTHORS, GUESTS)

    def test_rejects_meta_description_too_long(self) -> None:
        with pytest.raises(RowValidationError, match=r"troppo lunga \(200, servono 140–155\)"):
            validate_row(_row(meta_description="a" * 200), "Corpo.", AUTHORS, GUESTS)

    def test_cover_image_ref_defaults_to_none(self) -> None:
        result = validate_row(_row(copertina="  "), "Corpo.", AUTHORS, GUESTS)
        assert result.cover_image_ref is None

    def test_no_tags_is_valid(self) -> None:
        result = validate_row(_row(tag=""), "Corpo.", AUTHORS, GUESTS)
        assert result.tags == []
