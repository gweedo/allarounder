from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from ingest.deferred_esito import flush_deferred_outcomes, write_deferred_outcomes
from ingest.orchestrator import RowOutcome


@dataclass
class FakeSheetsClient:
    written: dict[int, str] = field(default_factory=dict)

    def read_rows(self) -> list[object]:
        return []

    def write_esito(self, row_number: int, message: str) -> None:
        self.written[row_number] = message


class TestWriteDeferredOutcomes:
    def test_writes_json_with_row_number_and_esito(self, tmp_path: Path) -> None:
        path = tmp_path / "deferred-esito.json"
        write_deferred_outcomes(path, [RowOutcome(2, "✓ Pubblicato 14:32")])

        assert path.exists()
        assert '"row_number": 2' in path.read_text(encoding="utf-8")
        assert "✓ Pubblicato 14:32" in path.read_text(encoding="utf-8")

    def test_writes_empty_list(self, tmp_path: Path) -> None:
        path = tmp_path / "deferred-esito.json"
        write_deferred_outcomes(path, [])

        assert path.read_text(encoding="utf-8").strip() == "[]"


class TestFlushDeferredOutcomes:
    def test_missing_file_is_a_noop(self, tmp_path: Path) -> None:
        sheets = FakeSheetsClient()
        count = flush_deferred_outcomes(sheets, tmp_path / "does-not-exist.json")

        assert count == 0
        assert sheets.written == {}

    def test_flushes_every_deferred_outcome(self, tmp_path: Path) -> None:
        path = tmp_path / "deferred-esito.json"
        write_deferred_outcomes(
            path, [RowOutcome(2, "✓ Pubblicato 14:32"), RowOutcome(5, "✓ Pubblicato 14:33")]
        )
        sheets = FakeSheetsClient()

        count = flush_deferred_outcomes(sheets, path)

        assert count == 2
        assert sheets.written == {2: "✓ Pubblicato 14:32", 5: "✓ Pubblicato 14:33"}

    def test_round_trip_through_write_then_flush(self, tmp_path: Path) -> None:
        path = tmp_path / "deferred-esito.json"
        outcomes = [RowOutcome(3, "✓ Pubblicato 09:00")]
        write_deferred_outcomes(path, outcomes)

        sheets = FakeSheetsClient()
        flush_deferred_outcomes(sheets, path)

        assert sheets.written[3] == "✓ Pubblicato 09:00"
