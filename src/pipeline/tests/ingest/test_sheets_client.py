from unittest.mock import MagicMock

from ingest.drive_client import extract_doc_id
from ingest.sheets_client import (
    COLUMNS,
    GoogleSheetsClient,
    _column_letter,
    cell_text,
    parse_row,
)


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


class TestCellText:
    def test_plain_cell_uses_formatted_value(self) -> None:
        assert (
            cell_text("titolo", {"formattedValue": "Intervista a Marco"})
            == "Intervista a Marco"
        )

    def test_empty_cell_is_empty_string(self) -> None:
        assert cell_text("doc", {}) == ""

    def test_file_chip_in_doc_column_yields_its_uri(self) -> None:
        # A Drive link the writer let Sheets turn into a smart chip: the
        # formatted value is only the Doc's title, the URL is in chipRuns.
        cell = {
            "formattedValue": "Articolo Test",
            "chipRuns": [
                {
                    "chip": {
                        "richLinkProperties": {
                            "uri": "https://docs.google.com/document/d/abc123/edit",
                            "mimeType": "application/vnd.google-apps.document",
                        }
                    }
                }
            ],
        }
        assert (
            cell_text("doc", cell) == "https://docs.google.com/document/d/abc123/edit"
        )

    def test_chip_after_a_plain_text_run_is_still_found(self) -> None:
        cell = {
            "formattedValue": "vedi Articolo Test",
            "chipRuns": [
                {},
                {
                    "startIndex": 5,
                    "chip": {
                        "richLinkProperties": {
                            "uri": "https://drive.google.com/file/d/img1/view"
                        }
                    },
                },
            ],
        }
        assert (
            cell_text("copertina", cell) == "https://drive.google.com/file/d/img1/view"
        )

    def test_hyperlinked_text_in_link_column_yields_the_link(self) -> None:
        cell = {
            "formattedValue": "Episodio 12",
            "hyperlink": "https://open.spotify.com/episode/xyz",
        }
        assert cell_text("spotify", cell) == "https://open.spotify.com/episode/xyz"

    def test_links_in_text_columns_are_ignored(self) -> None:
        cell = {
            "formattedValue": "Intervista a Marco",
            "hyperlink": "https://example.com",
        }
        assert cell_text("titolo", cell) == "Intervista a Marco"


class TestGoogleSheetsClientReadRows:
    def test_reads_chip_links_and_numbers_rows_from_two(self) -> None:
        service = MagicMock()
        service.spreadsheets().get().execute.return_value = {
            "sheets": [
                {
                    "data": [
                        {
                            "rowData": [
                                {
                                    "values": [
                                        {"formattedValue": "Articolo Test"},
                                        {
                                            "formattedValue": "Articolo Test",
                                            "chipRuns": [
                                                {
                                                    "chip": {
                                                        "richLinkProperties": {
                                                            "uri": "https://docs.google.com/document/d/abc123/edit"
                                                        }
                                                    }
                                                }
                                            ],
                                        },
                                    ]
                                },
                                {},
                                {"values": [{"formattedValue": "Secondo"}]},
                            ]
                        }
                    ]
                }
            ]
        }
        rows = GoogleSheetsClient(service, "sheet-id").read_rows()

        assert [r.row_number for r in rows] == [2, 3, 4]
        assert rows[0].doc == "https://docs.google.com/document/d/abc123/edit"
        assert rows[0].titolo == "Articolo Test"
        assert rows[1].titolo == ""
        assert rows[2].titolo == "Secondo"
        _, kwargs = service.spreadsheets().get.call_args
        assert kwargs["ranges"] == ["Articoli!A2:L"]
        assert "chipRuns" in kwargs["fields"]

    def test_empty_sheet_has_no_rows(self) -> None:
        service = MagicMock()
        service.spreadsheets().get().execute.return_value = {"sheets": [{"data": [{}]}]}
        assert GoogleSheetsClient(service, "sheet-id").read_rows() == []


def test_live_doc_cell_shape_resolves_to_a_doc_id() -> None:
    # Verbatim from the live Sheet (2026-10-14): the cell Sheets displays as
    # a chip came back with no chipRuns, its URL only in `hyperlink`.
    cell = {
        "formattedValue": "Articolo Test",
        "hyperlink": "https://docs.google.com/open?id=1Q1dCB5KEWEUzla1c5T440sdi06LI-99cUjbFojwYqec",
    }
    assert (
        extract_doc_id(cell_text("doc", cell))
        == "1Q1dCB5KEWEUzla1c5T440sdi06LI-99cUjbFojwYqec"
    )
