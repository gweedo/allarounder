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
    local = now.astimezone(ROME_TZ)
    return f"✓ Pubblicato {local:%H:%M}"


def format_scheduled(data_cell: str) -> str:
    return f"⏳ Programmato per {data_cell.strip()}"


def format_failure(message: str) -> str:
    return f"✗ {message}"


def should_update(current_esito: str, new_esito: str) -> bool:
    return current_esito.strip() != new_esito.strip()
