"""Guards against a stalled `content/publish-*` PR silently piling up.

Each publish run opens content PRs on a unique branch
(`content/publish-<run_id>`). If one stalls -- a failed check, auto-merge
disabled, a conflict -- the article it carries is absent from `main`'s
`index.json`, so the skip check never fires and the next run (nightly cron
or another "Pubblica" click) opens a competing PR instead of noticing.
`.github/workflows/publish.yml` runs this before the pipeline itself, so a
stalled PR fails the run loudly instead of stacking a second one -- see
docs/DECISIONS.md "Deferred esito writes and publish-run guards".

`find_stalled_pr` is pure and unit-tested; `main()` is the real `gh` call.
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any

_BRANCH_PREFIX = "content/publish-"


def find_stalled_pr(open_prs: list[dict[str, Any]]) -> dict[str, Any] | None:
    """`open_prs` is the JSON list from `gh pr list --json
    number,headRefName,url --state open`. Returns the first PR whose head
    branch is a publish-run branch, or None if none is open."""
    for pr in open_prs:
        if pr.get("headRefName", "").startswith(_BRANCH_PREFIX):
            return pr
    return None


def main() -> int:  # pragma: no cover -- real `gh` call, see ingest/cli.py
    result = subprocess.run(
        ["gh", "pr", "list", "--json", "number,headRefName,url", "--state", "open"],
        check=True,
        capture_output=True,
        text=True,
    )
    stalled = find_stalled_pr(json.loads(result.stdout))
    if stalled is not None:
        print(
            f"an open publish PR already exists (#{stalled['number']}, {stalled['url']}) "
            "-- not opening another; resolve or close it first",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
