"""Domain tests for MetaDescription value object."""

import pytest

from domain.content.value_objects import (
    META_DESCRIPTION_MAX_LENGTH,
    META_DESCRIPTION_MIN_LENGTH,
    MetaDescription,
)


class TestMetaDescription:
    def test_accepts_minimum_length(self) -> None:
        value = "a" * META_DESCRIPTION_MIN_LENGTH
        assert MetaDescription(value).value == value

    def test_accepts_maximum_length(self) -> None:
        value = "a" * META_DESCRIPTION_MAX_LENGTH
        assert MetaDescription(value).value == value

    def test_accepts_length_within_range(self) -> None:
        value = "a" * 148
        assert MetaDescription(value).value == value

    def test_str_returns_value(self) -> None:
        value = "a" * 145
        assert str(MetaDescription(value)) == value

    def test_rejects_too_short(self) -> None:
        with pytest.raises(ValueError):
            MetaDescription("a" * (META_DESCRIPTION_MIN_LENGTH - 1))

    def test_rejects_too_long(self) -> None:
        with pytest.raises(ValueError):
            MetaDescription("a" * (META_DESCRIPTION_MAX_LENGTH + 1))

    def test_rejects_empty(self) -> None:
        with pytest.raises(ValueError):
            MetaDescription("")
