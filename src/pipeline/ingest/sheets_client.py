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

# Columns that hold a link. Sheets lets a writer turn a pasted Drive URL into
# a smart chip, after which the cell's value is only the file's title -- the
# URL survives only in the cell's chip (or hyperlink) metadata.
LINK_COLUMNS = frozenset({"doc", "spotify", "copertina"})

_CELL_FIELDS = "sheets.data.rowData.values(formattedValue,hyperlink,chipRuns)"


def parse_row(row_number: int, values: list[str]) -> SheetRow:
    padded = list(values) + [""] * (len(COLUMNS) - len(values))
    cells = dict(zip(COLUMNS, padded, strict=False))
    return SheetRow(row_number=row_number, **cells)


def cell_text(column: str, cell: dict[str, Any]) -> str:
    """A Sheets API CellData -> the string the pipeline reads for `column`:
    the displayed value, or for a link column the chip's or hyperlink's URL."""
    if column in LINK_COLUMNS:
        for run in cell.get("chipRuns", []):
            uri = run.get("chip", {}).get("richLinkProperties", {}).get("uri")
            if uri:
                return str(uri)
        if cell.get("hyperlink"):
            return str(cell["hyperlink"])
    return str(cell.get("formattedValue", ""))


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

    def __init__(
        self, service: Any, spreadsheet_id: str, sheet_name: str = "Articoli"
    ) -> None:
        self._service = service
        self._spreadsheet_id = spreadsheet_id
        self._sheet_name = sheet_name

    def read_rows(self) -> list[SheetRow]:
        last_column = _column_letter(len(COLUMNS))
        range_ = f"{self._sheet_name}!A2:{last_column}"
        # spreadsheets.get, not values.get: only grid data carries chipRuns
        # and hyperlink, which a smart-chip `doc` cell needs (see LINK_COLUMNS).
        result = (
            self._service.spreadsheets()
            .get(
                spreadsheetId=self._spreadsheet_id, ranges=[range_], fields=_CELL_FIELDS
            )
            .execute()
        )
        row_data = result["sheets"][0]["data"][0].get("rowData", [])
        return [
            parse_row(
                i + 2,
                [
                    cell_text(column, cell)
                    for column, cell in zip(
                        COLUMNS, row.get("values", []), strict=False
                    )
                ],
            )
            for i, row in enumerate(row_data)
        ]

    def write_esito(self, row_number: int, message: str) -> None:
        column = _column_letter(_ESITO_COLUMN_INDEX)
        range_ = f"{self._sheet_name}!{column}{row_number}"
        self._service.spreadsheets().values().update(
            spreadsheetId=self._spreadsheet_id,
            range=range_,
            valueInputOption="RAW",
            body={"values": [[message]]},
        ).execute()
