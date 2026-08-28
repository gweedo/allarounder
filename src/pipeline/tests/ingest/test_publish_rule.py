from datetime import UTC, datetime

import pytest

from ingest.publish_rule import (
    Eligibility,
    evaluate,
    parse_publish_date,
    publish_at_utc,
)


class TestEvaluate:
    def test_bozza_is_not_publishable(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        assert evaluate("Bozza", "2026-08-01", now) is Eligibility.NOT_PUBLISHABLE

    def test_pronto_is_not_publishable(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        assert evaluate("Pronto", "2026-08-01", now) is Eligibility.NOT_PUBLISHABLE

    def test_pubblicato_with_past_date_is_published(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        assert evaluate("Pubblicato", "2026-08-01", now) is Eligibility.PUBLISHED

    def test_pubblicato_with_future_date_is_scheduled(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        assert evaluate("Pubblicato", "2026-09-01", now) is Eligibility.SCHEDULED

    def test_pubblicato_with_todays_date_is_published(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        assert evaluate("Pubblicato", "2026-08-27", now) is Eligibility.PUBLISHED

    def test_evaluates_in_europe_rome_time_near_midnight_utc(self) -> None:
        # 2026-08-27 23:30 UTC is 2026-08-28 01:30 in Europe/Rome (CEST, UTC+2)
        # -- a "2026-08-28" row must already be eligible, not scheduled.
        now = datetime(2026, 8, 27, 23, 30, tzinfo=UTC)
        assert evaluate("Pubblicato", "2026-08-28", now) is Eligibility.PUBLISHED

    def test_rejects_malformed_date(self) -> None:
        now = datetime(2026, 8, 27, 12, 0, tzinfo=UTC)
        with pytest.raises(ValueError):
            evaluate("Pubblicato", "27/08/2026", now)


class TestParsePublishDate:
    def test_parses_iso_date(self) -> None:
        assert parse_publish_date("2026-08-27").isoformat() == "2026-08-27"

    def test_strips_whitespace(self) -> None:
        assert parse_publish_date("  2026-08-27  ").isoformat() == "2026-08-27"


class TestPublishAtUtc:
    def test_summer_date_converts_from_cest(self) -> None:
        # Europe/Rome is UTC+2 in August (CEST).
        result = publish_at_utc("2026-08-27")
        assert result.isoformat() == "2026-08-26T22:00:00+00:00"

    def test_winter_date_converts_from_cet(self) -> None:
        # Europe/Rome is UTC+1 in January (CET).
        result = publish_at_utc("2026-01-15")
        assert result.isoformat() == "2026-01-14T23:00:00+00:00"
