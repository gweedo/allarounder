"""Persists and flushes the `✓ Pubblicato` esito writes `orchestrator.run()`
defers (see `RunReport.deferred`) -- see docs/DECISIONS.md "Deferred esito
writes and publish-run guards" for why. `ingest/cli.py` writes the file after
a run; `ingest/flush_esito.py` flushes it once the generated content PR is
confirmed merged.
"""

from __future__ import annotations

import json
from pathlib import Path

from ingest.orchestrator import RowOutcome
from ingest.sheets_client import SheetsClient

DEFAULT_DEFERRED_ESITO_PATH = "deferred-esito.json"


def write_deferred_outcomes(path: Path, outcomes: list[RowOutcome]) -> None:
    payload = [{"row_number": o.row_number, "esito": o.esito} for o in outcomes]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def flush_deferred_outcomes(sheets: SheetsClient, path: Path) -> int:
    """Writes every deferred outcome to the Sheet and returns how many were
    written. A missing file means nothing was deferred this run (no new
    `✓ Pubblicato`, or the content diff was empty) -- a no-op, not an error,
    so this is safe to call unconditionally."""
    if not path.exists():
        return 0
    payload = json.loads(path.read_text(encoding="utf-8"))
    for entry in payload:
        sheets.write_esito(entry["row_number"], entry["esito"])
    return len(payload)
