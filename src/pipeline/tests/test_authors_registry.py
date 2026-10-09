"""Checks on the committed author registry and its Sheet-side copy.

`autore` is matched strictly (CONTENT-CONTRACT.md §4): a row whose author is
not in authors.json is rejected. The Sheet's `autore` dropdown comes from
AUTORI in tools/apps-script/src/Columns.js, a hand-maintained copy of the
registry's names. If the two drift, the dropdown offers a name the pipeline
then rejects -- so these tests pin them together.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from domain.content.value_objects import Slug

REPO_ROOT = Path(__file__).resolve().parents[3]
AUTHORS_JSON = REPO_ROOT / "src" / "pipeline" / "data" / "authors.json"
COLUMNS_JS = REPO_ROOT / "tools" / "apps-script" / "src" / "Columns.js"


def _registry() -> list[dict[str, object]]:
    with open(AUTHORS_JSON, encoding="utf-8") as f:
        data: list[dict[str, object]] = json.load(f)
    return data


def _autori() -> list[str]:
    source = COLUMNS_JS.read_text(encoding="utf-8")
    match = re.search(r"var AUTORI = (\[.*?\]);", source, re.DOTALL)
    assert match, "AUTORI array not found in Columns.js"
    names: list[str] = json.loads(match.group(1))
    return names


def test_sheet_dropdown_matches_registry() -> None:
    assert _autori() == [author["name"] for author in _registry()]


def test_registry_lists_the_editorial_team() -> None:
    names = {author["name"] for author in _registry()}
    # Public bylines: the names the writers sign their articles with.
    assert names == {"Guido S.", "Fabio Soncini", "Umberto Zurlini", "Chiara Simonelli"}


def test_registry_slugs_are_derived_from_names() -> None:
    for author in _registry():
        assert author["slug"] == Slug.from_title(str(author["name"])).value
