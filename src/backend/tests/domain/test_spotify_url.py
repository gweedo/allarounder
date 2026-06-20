"""Domain tests for SpotifyUrl value object."""

import pytest

from app.domain.content.value_objects import SpotifyUrl


class TestSpotifyUrl:
    def test_valid_episode_url(self) -> None:
        url = SpotifyUrl("https://open.spotify.com/episode/3JlVkNIjIJKvINYpDrVFUP")
        assert url.value == "https://open.spotify.com/episode/3JlVkNIjIJKvINYpDrVFUP"

    def test_valid_show_url(self) -> None:
        url = SpotifyUrl("https://open.spotify.com/show/abc123XYZ")
        assert url.value == "https://open.spotify.com/show/abc123XYZ"

    def test_str_returns_value(self) -> None:
        url = SpotifyUrl("https://open.spotify.com/episode/abc123")
        assert str(url) == "https://open.spotify.com/episode/abc123"

    def test_rejects_non_spotify_url(self) -> None:
        with pytest.raises(ValueError):
            SpotifyUrl("https://music.apple.com/album/123")

    def test_rejects_http(self) -> None:
        with pytest.raises(ValueError):
            SpotifyUrl("http://open.spotify.com/episode/abc123")

    def test_rejects_blank(self) -> None:
        with pytest.raises(ValueError):
            SpotifyUrl("")

    def test_rejects_spotify_without_path(self) -> None:
        with pytest.raises(ValueError):
            SpotifyUrl("https://open.spotify.com/")

    def test_rejects_non_episode_show_path(self) -> None:
        with pytest.raises(ValueError):
            SpotifyUrl("https://open.spotify.com/playlist/abc123")
