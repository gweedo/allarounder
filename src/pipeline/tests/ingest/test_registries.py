from pathlib import Path

from ingest.registries import (
    Profile,
    load_registry,
    match_author,
    match_or_create_guest,
    normalize_name,
    split_names,
)


class TestNormalizeName:
    def test_case_insensitive(self) -> None:
        assert normalize_name("Guido S.") == normalize_name("guido s.")

    def test_accent_insensitive(self) -> None:
        assert normalize_name("Federica") == normalize_name("Fédérica")

    def test_collapses_whitespace(self) -> None:
        assert normalize_name("Guido   S.") == normalize_name("Guido S.")


class TestLoadRegistry:
    def test_loads_entries(self, tmp_path: Path) -> None:
        path = tmp_path / "authors.json"
        path.write_text(
            '[{"slug": "guido-s", "name": "Guido S.", "bio": "bio", '
            '"photo_url": null, "links": {}}]',
            encoding="utf-8",
        )
        registry = load_registry(path)
        assert registry == [Profile(slug="guido-s", name="Guido S.", bio="bio")]

    def test_missing_file_returns_empty(self, tmp_path: Path) -> None:
        assert load_registry(tmp_path / "missing.json") == []


class TestMatchAuthor:
    def test_matches_case_and_accent_insensitively(self) -> None:
        registry = [Profile(slug="guido-s", name="Guido S.")]
        assert match_author("guido s.", registry) is registry[0]

    def test_returns_none_when_unmatched(self) -> None:
        registry = [Profile(slug="guido-s", name="Guido S.")]
        assert match_author("Marco", registry) is None


class TestMatchOrCreateGuest:
    def test_returns_registry_entry_when_matched(self) -> None:
        registry = [Profile(slug="mario-rossi", name="Mario Rossi", bio="bio")]
        result = match_or_create_guest("Mario Rossi", registry)
        assert result is registry[0]

    def test_creates_minimal_profile_when_unmatched(self) -> None:
        result = match_or_create_guest("Nuova Ginnasta", [])
        assert result == Profile(slug="nuova-ginnasta", name="Nuova Ginnasta")


class TestSplitNames:
    def test_splits_and_trims(self) -> None:
        assert split_names("Mondiali,  Esordienti ,Serie A") == [
            "Mondiali",
            "Esordienti",
            "Serie A",
        ]

    def test_empty_cell_returns_empty_list(self) -> None:
        assert split_names("") == []

    def test_ignores_stray_commas(self) -> None:
        assert split_names("Mondiali,,") == ["Mondiali"]
