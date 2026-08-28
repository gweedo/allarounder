"""Google Sheets access: read rows, write `esito` (CONTENT-CONTRACT.md §1, §7).

Sheets is read/write for the service account (CONTENT-CONTRACT.md §8) --
unlike Drive, which is read-only.
"""

from __future__ import annotations

from typing import Any, Protocol

from ingest.models import SheetRow

COLUMNS = (
    "titolo",
    "doc",
    "categoria",
    "tag",
    "autore",
    "ospite",
    "spotify",
    "copertina",
    "meta_description",
    "data",
    "stato",
    "esito",
)

_ESITO_COLUMN_INDEX = len(COLUMNS)  # 1-indexed column letter offset for "esito"


def parse_row(row_number: int, values: list[str]) -> SheetRow:
    padded = list(values) + [""] * (len(COLUMNS) - len(values))
    cells = dict(zip(COLUMNS, padded, strict=False))
    return SheetRow(row_number=row_number, **cells)


class SheetsClient(Protocol):
    def read_rows(self) -> list[SheetRow]: ...

    def write_esito(self, row_number: int, message: str) -> None: ...


def _column_letter(index: int) -> str:
    """1-indexed column number -> spreadsheet column letter."""
    letters = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


class GoogleSheetsClient:
    """Real implementation, backed by the Sheets API v4."""

    def __init__(self, service: Any, spreadsheet_id: str, sheet_name: str = "Articoli") -> None:
        self._service = service
        self._spreadsheet_id = spreadsheet_id
        self._sheet_name = sheet_name

    def read_rows(self) -> list[SheetRow]:
        last_column = _column_letter(len(COLUMNS))
        range_ = f"{self._sheet_name}!A2:{last_column}"
        result = (
            self._service.spreadsheets()
            .values()
            .get(spreadsheetId=self._spreadsheet_id, range=range_)
            .execute()
        )
        rows = result.get("values", [])
        return [parse_row(i + 2, row) for i, row in enumerate(rows)]

    def write_esito(self, row_number: int, message: str) -> None:
        column = _column_letter(_ESITO_COLUMN_INDEX)
        range_ = f"{self._sheet_name}!{column}{row_number}"
        self._service.spreadsheets().values().update(
            spreadsheetId=self._spreadsheet_id,
            range=range_,
            valueInputOption="RAW",
            body={"values": [[message]]},
        ).execute()
