"""Pipeline entrypoint, invoked by `.github/workflows/publish.yml`.

No live Drive/Sheets credentials exist in this environment or in tests --
this module is exercised by `.github/workflows/publish.yml` in CI/production
only. It is intentionally thin: real Google API wiring plus the
`sheet_id` guard from CONTENT-CONTRACT.md §8, nothing else.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

from ingest.config import ConfigError, load_config
from ingest.drive_client import GoogleDriveClient
from ingest.orchestrator import run
from ingest.sheets_client import GoogleSheetsClient

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# src/pipeline/ingest/cli.py -> repo root is three levels up.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTENT_DIR = _REPO_ROOT / "src" / "frontend" / "content"
_PUBLIC_DIR = _REPO_ROOT / "src" / "frontend" / "public"
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _dispatched_sheet_id() -> str | None:
    """Reads `client_payload.sheet_id` from the `repository_dispatch` event
    GitHub Actions writes to `GITHUB_EVENT_PATH` (CONTENT-CONTRACT.md §8).
    Absent on the nightly-cron / `workflow_dispatch` triggers, which carry no
    such payload."""
    payload_path = os.environ.get("GITHUB_EVENT_PATH")
    if not payload_path or not Path(payload_path).exists():
        return None
    event = json.loads(Path(payload_path).read_text(encoding="utf-8"))
    sheet_id = event.get("client_payload", {}).get("sheet_id")
    return str(sheet_id) if sheet_id else None


def main() -> int:
    try:
        config = load_config()
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1

    dispatched_sheet_id = _dispatched_sheet_id()
    if dispatched_sheet_id is not None and dispatched_sheet_id != config.sheet_id:
        print(
            f"repository_dispatch sheet_id {dispatched_sheet_id!r} does not match "
            f"configured SHEET_ID {config.sheet_id!r} -- aborting without touching esito",
            file=sys.stderr,
        )
        return 1

    credentials = service_account.Credentials.from_service_account_info(
        json.loads(config.service_account_json), scopes=_SCOPES
    )
    sheets_service = build("sheets", "v4", credentials=credentials)
    drive_service = build("drive", "v3", credentials=credentials)

    report = run(
        GoogleSheetsClient(sheets_service, config.sheet_id, config.sheet_name),
        GoogleDriveClient(drive_service),
        _CONTENT_DIR,
        _PUBLIC_DIR,
        _DATA_DIR / "authors.json",
        _DATA_DIR / "guests.json",
        datetime.now(UTC),
    )
    for outcome in report.outcomes:
        print(f"row {outcome.row_number}: {outcome.esito}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
