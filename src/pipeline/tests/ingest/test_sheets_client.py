from ingest.sheets_client import COLUMNS, _column_letter, parse_row


class TestColumnLetter:
    def test_single_letter(self) -> None:
        assert _column_letter(1) == "A"
        assert _column_letter(12) == "L"

    def test_double_letter(self) -> None:
        assert _column_letter(27) == "AA"


class TestParseRow:
    def test_parses_full_row(self) -> None:
        values = [
            "Intervista a Marco",
            "https://docs.google.com/document/d/abc123/edit",
            "Interviste",
            "Mondiali",
            "Guido S.",
            "Marco Bianchi",
            "https://open.spotify.com/episode/abc123",
            "",
            "Descrizione." * 12,
            "2026-08-27",
            "Pubblicato",
            "",
        ]
        row = parse_row(2, values)
        assert row.row_number == 2
        assert row.titolo == "Intervista a Marco"
        assert row.stato == "Pubblicato"

    def test_pads_missing_trailing_columns(self) -> None:
        row = parse_row(3, ["Titolo"])
        assert row.titolo == "Titolo"
        assert row.doc == ""
        assert row.esito == ""
        assert len(COLUMNS) == 12
