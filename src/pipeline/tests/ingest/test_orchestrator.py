"""End-to-end orchestrator tests against fake Sheets/Drive clients and a
tmp_path content tree.

No live Google Drive/Sheets credentials exist in this environment --
CONTENT-CONTRACT.md-compliant behavior is verified against these recorded
fixtures, not a live Sheet or Doc. Real API wiring lives in `cli.py`, which
this suite does not exercise.
"""

from __future__ import annotations

import io
import json
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import pytest

from ingest.drive_client import parse_export_zip
from ingest.models import DocExport, SheetRow
from ingest.orchestrator import run

NOW = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)

VALID_META = (
    "Una chiacchierata approfondita su obiettivi, avversarie e percorso "
    "verso i Mondiali di ginnastica artistica, con dettagli sulla preparazione."
)
assert 140 <= len(VALID_META) <= 155


def _build_zip(html: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("doc.html", html)
    return buffer.getvalue()


@dataclass
class FakeSheetsClient:
    rows: list[SheetRow]
    written: dict[int, str] = field(default_factory=dict)

    def read_rows(self) -> list[SheetRow]:
        return self.rows

    def write_esito(self, row_number: int, message: str) -> None:
        self.written[row_number] = message


@dataclass
class FakeDriveClient:
    docs: dict[str, str]
    modified_times: dict[str, str] = field(default_factory=dict)

    def export_doc(self, doc_id: str) -> DocExport:
        return parse_export_zip(_build_zip(self.docs[doc_id]))

    def get_modified_time(self, doc_id: str) -> str:
        return self.modified_times.get(doc_id, "2026-08-27T00:00:00.000Z")

    def download_file(self, file_ref: str) -> bytes:
        return b"cover-bytes"


def _row(**overrides: str) -> SheetRow:
    defaults: dict[str, str | int] = {
        "row_number": 2,
        "titolo": "Intervista a Marco",
        "doc": "doc-1",
        "categoria": "Interviste",
        "tag": "Mondiali",
        "autore": "Guido S.",
        "ospite": "Marco Bianchi",
        "spotify": "",
        "copertina": "",
        "meta_description": VALID_META,
        "data": "2026-08-01",
        "stato": "Pubblicato",
        "esito": "",
    }
    defaults.update(overrides)
    return SheetRow(**defaults)  # type: ignore[arg-type]


@pytest.fixture
def pipeline_dirs(tmp_path: Path) -> tuple[Path, Path, Path]:
    content_dir = tmp_path / "content"
    public_dir = tmp_path / "public"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "authors.json").write_text(
        '[{"slug": "guido-s", "name": "Guido S.", "bio": null, '
        '"photo_url": null, "links": {}}]',
        encoding="utf-8",
    )
    (data_dir / "guests.json").write_text("[]", encoding="utf-8")
    return content_dir, public_dir, data_dir


def _run(
    dirs: tuple[Path, Path, Path],
    sheets: FakeSheetsClient,
    drive: FakeDriveClient,
    now: datetime = NOW,
) -> Iterable[object]:
    content_dir, public_dir, data_dir = dirs
    report = run(
        sheets,
        drive,
        content_dir,
        public_dir,
        data_dir / "authors.json",
        data_dir / "guests.json",
        now,
    )
    return report.outcomes


class TestRun:
    def test_publishes_new_article(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        content_dir, _, _ = pipeline_dirs
        sheets = FakeSheetsClient(rows=[_row()])
        drive = FakeDriveClient(docs={"doc-1": "<h1>Titolo</h1><p>Corpo.</p>"})

        outcomes = list(_run(pipeline_dirs, sheets, drive))

        assert len(list(outcomes)) == 1
        assert sheets.written[2].startswith("✓ Pubblicato")
        index = json.loads((content_dir / "index.json").read_text(encoding="utf-8"))
        assert index["articles"][0]["slug"] == "intervista-a-marco"
        assert (content_dir / "articles" / "intervista-a-marco.md").exists()

    def test_skips_draft_rows(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        sheets = FakeSheetsClient(rows=[_row(stato="Bozza")])
        drive = FakeDriveClient(docs={})

        outcomes = list(_run(pipeline_dirs, sheets, drive))

        assert outcomes == []
        assert sheets.written == {}

    def test_scheduled_row_gets_scheduled_esito(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        sheets = FakeSheetsClient(rows=[_row(data="2026-09-01")])
        drive = FakeDriveClient(docs={})

        _run(pipeline_dirs, sheets, drive)

        assert sheets.written[2] == "⏳ Programmato per 2026-09-01"

    def test_validation_failure_writes_italian_error(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        sheets = FakeSheetsClient(rows=[_row(autore="Sconosciuto")])
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>"})

        _run(pipeline_dirs, sheets, drive)

        assert "non riconosciuto" in sheets.written[2]

    def test_malformed_date_writes_italian_error(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        sheets = FakeSheetsClient(rows=[_row(data="27/08/2026")])
        drive = FakeDriveClient(docs={})

        _run(pipeline_dirs, sheets, drive)

        assert "non valida" in sheets.written[2]

    def test_republish_same_doc_keeps_locked_slug_after_title_change(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        content_dir, _, _ = pipeline_dirs
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>"})
        _run(pipeline_dirs, FakeSheetsClient(rows=[_row()]), drive)

        _run(pipeline_dirs, FakeSheetsClient(rows=[_row(titolo="Titolo Cambiato")]), drive)

        index = json.loads((content_dir / "index.json").read_text(encoding="utf-8"))
        assert len(index["articles"]) == 1
        assert index["articles"][0]["slug"] == "intervista-a-marco"
        assert index["articles"][0]["title"] == "Titolo Cambiato"

    def test_unchanged_success_esito_is_not_rewritten(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>"})
        first_sheets = FakeSheetsClient(rows=[_row()])
        _run(pipeline_dirs, first_sheets, drive)
        previous_esito = first_sheets.written[2]

        second_sheets = FakeSheetsClient(rows=[_row(esito=previous_esito)])
        outcomes = list(_run(pipeline_dirs, second_sheets, drive))

        assert outcomes == []
        assert second_sheets.written == {}

    def test_cover_image_written_when_present(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        _, public_dir, _ = pipeline_dirs
        sheets = FakeSheetsClient(rows=[_row(copertina="cover-file-id")])
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>"})

        _run(pipeline_dirs, sheets, drive)

        assert (public_dir / "images" / "intervista-a-marco" / "cover.png").exists()

    def test_slug_collision_with_different_doc_writes_italian_error(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>", "doc-2": "<p>Altro corpo.</p>"})
        _run(pipeline_dirs, FakeSheetsClient(rows=[_row()]), drive)

        colliding_sheets = FakeSheetsClient(rows=[_row(doc="doc-2")])
        _run(pipeline_dirs, colliding_sheets, drive)

        assert "già usato" in colliding_sheets.written[2]
