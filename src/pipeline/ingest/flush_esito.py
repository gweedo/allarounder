"""Second half of the deferred-esito flow, invoked by
`.github/workflows/publish.yml` only after the generated-content PR is
confirmed MERGED -- see `ingest/deferred_esito.py` and docs/DECISIONS.md
"Deferred esito writes and publish-run guards".

No live Sheets credentials exist in this environment or in tests -- this
module is exercised by the workflow in CI/production only, same as
`ingest/cli.py`.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

from ingest.config import ConfigError, load_config
from ingest.deferred_esito import DEFAULT_DEFERRED_ESITO_PATH, flush_deferred_outcomes
from ingest.sheets_client import GoogleSheetsClient

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def main() -> int:
    try:
        config = load_config()
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1

    path = Path(os.environ.get("DEFERRED_ESITO_PATH", DEFAULT_DEFERRED_ESITO_PATH))
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(config.service_account_json), scopes=_SCOPES
    )
    sheets_service = build("sheets", "v4", credentials=credentials)
    sheets = GoogleSheetsClient(sheets_service, config.sheet_id, config.sheet_name)

    count = flush_deferred_outcomes(sheets, path)
    print(f"flushed {count} deferred esito write(s) from {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
