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
    file_names: dict[str, str] = field(default_factory=dict)
    export_doc_calls: list[str] = field(default_factory=list)

    def export_doc(self, doc_id: str) -> DocExport:
        self.export_doc_calls.append(doc_id)
        return parse_export_zip(_build_zip(self.docs[doc_id]))

    def get_modified_time(self, doc_id: str) -> str:
        return self.modified_times.get(doc_id, "2026-08-27T00:00:00.000Z")

    def download_file(self, file_ref: str) -> bytes:
        return b"cover-bytes"

    def get_file_name(self, file_ref: str) -> str:
        return self.file_names.get(file_ref, "cover.png")


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
        drive = FakeDriveClient(
            docs={"doc-1": "<p>Corpo.</p>"},
            modified_times={"doc-1": "2026-08-27T00:00:00.000Z"},
        )
        _run(pipeline_dirs, FakeSheetsClient(rows=[_row()]), drive)

        # The Doc itself was edited too (a different modifiedTime) -- an
        # unchanged Doc is skipped entirely (see TestSkipsUnchangedDoc
        # below), so the title change wouldn't otherwise be picked up.
        drive.modified_times["doc-1"] = "2026-08-28T00:00:00.000Z"
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

    def test_cover_image_with_real_drive_share_link_does_not_crash(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        # Regression test: `copertina` holds a Drive share URL or bare file
        # ID (CONTENT-CONTRACT.md §1), never an actual filename. Using it
        # directly as a filename for extension extraction used to produce a
        # multi-segment path fragment (e.g. "com/file/d/.../view") from the
        # URL's only "." and crash writing the file -- the fix resolves the
        # real filename via `drive.get_file_name` instead.
        _, public_dir, _ = pipeline_dirs
        share_link = "https://drive.google.com/file/d/1AbCdEf/view?usp=sharing"
        sheets = FakeSheetsClient(rows=[_row(copertina=share_link)])
        drive = FakeDriveClient(
            docs={"doc-1": "<p>Corpo.</p>"},
            file_names={share_link: "copertina-mondiali.jpg"},
        )

        _run(pipeline_dirs, sheets, drive)

        assert (public_dir / "images" / "intervista-a-marco" / "cover.jpg").exists()
        assert sheets.written[2].startswith("✓ Pubblicato")

    def test_unchanged_doc_skips_reexport_entirely(self, pipeline_dirs: tuple[Path, Path, Path]) -> None:
        drive = FakeDriveClient(
            docs={"doc-1": "<p>Corpo.</p>"},
            modified_times={"doc-1": "2026-08-27T00:00:00.000Z"},
        )
        first_sheets = FakeSheetsClient(rows=[_row()])
        _run(pipeline_dirs, first_sheets, drive)
        assert drive.export_doc_calls == ["doc-1"]
        previous_esito = first_sheets.written[2]

        # Same Doc, same modifiedTime, on a fresh run (e.g. the nightly
        # cron) -- must not re-export/re-convert an unchanged Doc.
        second_sheets = FakeSheetsClient(rows=[_row(esito=previous_esito)])
        _run(pipeline_dirs, second_sheets, drive)
        assert drive.export_doc_calls == ["doc-1"]

    def test_meta_description_edit_with_doc_untouched_regenerates_article(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        # A Sheet-only correction (the Doc's modifiedTime never changes)
        # must still reach the site -- the skip check is keyed on the Doc
        # *and* a hash of the content-bearing Sheet fields, not the Doc
        # alone.
        content_dir, _, _ = pipeline_dirs
        drive = FakeDriveClient(
            docs={"doc-1": "<p>Corpo.</p>"},
            modified_times={"doc-1": "2026-08-27T00:00:00.000Z"},
        )
        first_sheets = FakeSheetsClient(rows=[_row()])
        _run(pipeline_dirs, first_sheets, drive)
        assert drive.export_doc_calls == ["doc-1"]
        previous_esito = first_sheets.written[2]

        corrected_meta = (
            "Una nuova descrizione corretta per la SEO, abbastanza lunga da "
            "rispettare davvero il limite minimo di centoquaranta caratteri "
            "come richiesto dalle regole."
        )
        assert 140 <= len(corrected_meta) <= 155
        second_sheets = FakeSheetsClient(
            rows=[_row(esito=previous_esito, meta_description=corrected_meta)]
        )

        # A different time-of-day than the first run's `NOW`, so a genuine
        # re-publish produces a different (and therefore written) esito
        # message -- matching real usage, where wall-clock time has moved on.
        _run(pipeline_dirs, second_sheets, drive, now=datetime(2026, 8, 27, 15, 45, tzinfo=UTC))

        # Reprocessed despite the Doc being unchanged -- the row hash caught
        # the Sheet-side edit.
        assert drive.export_doc_calls == ["doc-1", "doc-1"]
        index = json.loads((content_dir / "index.json").read_text(encoding="utf-8"))
        assert index["articles"][0]["meta_description"] == corrected_meta
        assert second_sheets.written[2].startswith("✓ Pubblicato")

    def test_added_whitespace_alone_does_not_trigger_reprocessing(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        # The row hash must be computed on stripped values -- otherwise
        # incidental whitespace (which validate_row already normalizes away
        # before it reaches generated content) would trigger a spurious
        # Drive re-export and esito rewrite for a row that produces
        # byte-identical output.
        drive = FakeDriveClient(
            docs={"doc-1": "<p>Corpo.</p>"},
            modified_times={"doc-1": "2026-08-27T00:00:00.000Z"},
        )
        first_sheets = FakeSheetsClient(rows=[_row()])
        _run(pipeline_dirs, first_sheets, drive)
        assert drive.export_doc_calls == ["doc-1"]
        previous_esito = first_sheets.written[2]

        second_sheets = FakeSheetsClient(
            rows=[_row(esito=previous_esito, titolo="  Intervista a Marco  ")]
        )
        _run(pipeline_dirs, second_sheets, drive)

        assert drive.export_doc_calls == ["doc-1"]
        assert second_sheets.written == {}

    def test_unexpected_exception_on_one_row_does_not_abort_other_rows(
        self, pipeline_dirs: tuple[Path, Path, Path]
    ) -> None:
        content_dir, _, _ = pipeline_dirs

        class ExplodingDriveClient(FakeDriveClient):
            def export_doc(self, doc_id: str) -> DocExport:
                if doc_id == "doc-bad":
                    raise ConnectionError("drive api unreachable")
                return super().export_doc(doc_id)

        drive = ExplodingDriveClient(docs={"doc-good": "<p>Corpo.</p>", "doc-bad": "<p>Altro.</p>"})
        sheets = FakeSheetsClient(
            rows=[
                _row(row_number=2, titolo="Articolo Buono", doc="doc-good"),
                _row(row_number=3, titolo="Articolo Rotto", doc="doc-bad"),
            ]
        )

        _run(pipeline_dirs, sheets, drive)

        assert sheets.written[2].startswith("✓ Pubblicato")
        assert sheets.written[3] == (
            "✗ errore imprevisto durante l'importazione — controlla i log della pipeline"
        )
        index = json.loads((content_dir / "index.json").read_text(encoding="utf-8"))
        assert len(index["articles"]) == 1
        assert index["articles"][0]["title"] == "Articolo Buono"

    def test_esito_not_written_when_save_index_fails(
        self, pipeline_dirs: tuple[Path, Path, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # If content can't be saved, the Sheet must never claim success for
        # it -- regression test for the ordering bug where per-row
        # `write_esito` calls happened before `save_index`, so a crash
        # partway through left earlier rows' esito claiming success for
        # content that was never actually persisted.
        import ingest.content_writer as content_writer_module

        def _boom(*_args: object, **_kwargs: object) -> None:
            raise OSError("disk full")

        monkeypatch.setattr(content_writer_module, "save_index", _boom)

        sheets = FakeSheetsClient(rows=[_row()])
        drive = FakeDriveClient(docs={"doc-1": "<p>Corpo.</p>"})

        with pytest.raises(OSError, match="disk full"):
            _run(pipeline_dirs, sheets, drive)

        assert sheets.written == {}
