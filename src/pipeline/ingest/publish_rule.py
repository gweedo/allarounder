"""Publish-rule eligibility (CONTENT-CONTRACT.md §3).

`stato = Pubblicato AND data <= now`, evaluated in Europe/Rome time -- the
audience and the writers are both in Italy, so "today" means the same
calendar day to both a writer setting `data` and the build deciding whether
it has arrived.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from zoneinfo import ZoneInfo

ROME_TZ = ZoneInfo("Europe/Rome")
UTC_TZ = ZoneInfo("UTC")

_PUBBLICATO = "Pubblicato"


class Eligibility(enum.Enum):
    NOT_PUBLISHABLE = "not_publishable"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"


def parse_publish_date(data_cell: str) -> date:
    return date.fromisoformat(data_cell.strip())


def evaluate(stato: str, data_cell: str, now: datetime) -> Eligibility:
    if stato.strip() != _PUBBLICATO:
        return Eligibility.NOT_PUBLISHABLE
    publish_date = parse_publish_date(data_cell)
    now_rome = now.astimezone(ROME_TZ)
    if publish_date <= now_rome.date():
        return Eligibility.PUBLISHED
    return Eligibility.SCHEDULED


def publish_at_utc(data_cell: str) -> datetime:
    """The `data` cell interpreted at Europe/Rome midnight, converted to UTC
    (CONTENT-CONTRACT.md §5)."""
    publish_date = parse_publish_date(data_cell)
    midnight_rome = datetime(
        publish_date.year, publish_date.month, publish_date.day, tzinfo=ROME_TZ
    )
    return midnight_rome.astimezone(UTC_TZ)
