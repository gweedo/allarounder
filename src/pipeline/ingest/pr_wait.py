"""Blocks the workflow job until its own content PR is confirmed merged.

`concurrency: group: publish-content` in `.github/workflows/publish.yml`
serialises the *job*, but a job that exits right after `gh pr merge --auto`
releases that slot before the merge actually lands -- the next run can then
branch from a `main` that doesn't have this run's content yet. Polling here
until the PR reports MERGED keeps the concurrency group meaningful across
the whole publish, not just the pipeline step -- see docs/DECISIONS.md
"Deferred esito writes and publish-run guards".

`wait_for_merge` is pure (state-fetch, sleep, and clock are all injected)
and unit-tested with a fake clock and a scripted state sequence; `main()`
wires it to real `gh pr view` calls and real `time.sleep`.
"""

from __future__ import annotations

import subprocess
import sys
import time
from collections.abc import Callable

DEFAULT_TIMEOUT_SECONDS = 600
DEFAULT_POLL_INTERVAL_SECONDS = 15


def wait_for_merge(
    get_state: Callable[[], str],
    *,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    poll_interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> bool:
    """Returns True once `get_state()` reports "MERGED". Returns False --
    never raises -- once `timeout_seconds` elapses, so the caller decides how
    loudly to fail. A PR reporting "CLOSED" (closed without merging) fails
    fast rather than waiting out the full timeout, since it will never
    become MERGED on its own."""
    deadline = clock() + timeout_seconds
    while True:
        state = get_state()
        if state == "MERGED":
            return True
        if state == "CLOSED":
            return False
        if clock() >= deadline:
            return False
        sleep(poll_interval_seconds)


def _gh_state(pr_number: str) -> str:  # pragma: no cover -- real `gh` call
    result = subprocess.run(
        ["gh", "pr", "view", pr_number, "--json", "state", "-q", ".state"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def main() -> int:  # pragma: no cover -- real `gh` call, see ingest/cli.py
    if len(sys.argv) < 2:
        print("usage: python -m ingest.pr_wait <pr-number>", file=sys.stderr)
        return 2

    pr_number = sys.argv[1]
    merged = wait_for_merge(lambda: _gh_state(pr_number))
    if not merged:
        print(
            f"PR #{pr_number} did not merge within {DEFAULT_TIMEOUT_SECONDS}s -- "
            "failing the run so the next run's guard (ingest.pr_guard) catches it",
            file=sys.stderr,
        )
        return 1
    print(f"PR #{pr_number} merged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
