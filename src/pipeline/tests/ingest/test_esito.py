from datetime import UTC, datetime

from ingest.esito import format_failure, format_scheduled, format_success, should_update


class TestFormatSuccess:
    def test_formats_local_rome_time(self) -> None:
        # 12:32 UTC in August is 14:32 in Europe/Rome (CEST).
        now = datetime(2026, 8, 27, 12, 32, tzinfo=UTC)
        assert format_success(now) == "✓ Pubblicato 14:32"


class TestFormatScheduled:
    def test_formats_with_date(self) -> None:
        assert format_scheduled(" 2026-09-01 ") == "⏳ Programmato per 2026-09-01"


class TestFormatFailure:
    def test_prefixes_with_cross(self) -> None:
        assert format_failure("collegamento Spotify non valido") == "✗ collegamento Spotify non valido"


class TestShouldUpdate:
    def test_true_when_different(self) -> None:
        assert should_update("✗ vecchio errore", "✓ Pubblicato 14:32") is True

    def test_false_when_identical(self) -> None:
        assert should_update("✓ Pubblicato 14:32", "✓ Pubblicato 14:32") is False

    def test_ignores_surrounding_whitespace(self) -> None:
        assert should_update("  ✓ Pubblicato 14:32  ", "✓ Pubblicato 14:32") is False

    def test_true_when_current_is_empty(self) -> None:
        assert should_update("", "✓ Pubblicato 14:32") is True
