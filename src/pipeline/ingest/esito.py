"""`esito` write-back formatting (CONTENT-CONTRACT.md §7).

A single rule governs when the Sheet gets rewritten: only when the message
would change from what's already there. `should_update` implements that
rule; callers never need to enumerate "is this a fresh publish / a repeat
failure / an unchanged schedule" themselves.
"""

from __future__ import annotations

from datetime import datetime

from ingest.publish_rule import ROME_TZ


def format_success(now: datetime) -> str:
    """`now` is the moment this row was actually processed and published --
    the message must mean what it says, especially for a scheduled post
    where the Doc's last-edit time could be weeks before the real publish
    moment. Message *stability* across unchanged runs comes from the
    orchestrator's skip logic (an already-published row whose Doc hasn't
    changed reuses its existing `esito` verbatim rather than calling this
    again), not from this function -- it always reflects a real publish."""
    local = now.astimezone(ROME_TZ)
    return f"✓ Pubblicato {local:%H:%M}"


def format_scheduled(data_cell: str) -> str:
    return f"⏳ Programmato per {data_cell.strip()}"


def format_failure(message: str) -> str:
    return f"✗ {message}"


def should_update(current_esito: str, new_esito: str) -> bool:
    return current_esito.strip() != new_esito.strip()
