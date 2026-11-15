"""The shared JSON writer (#197): one format for articles and stats, and a
failed write never leaves a half-written file behind."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from ingest.content_writer import save_index
from ingest.jsonfile import write_json


def test_a_failure_mid_write_leaves_the_previous_file_intact(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "competitions" / "mondiali-2026-rotterdam.json"
    write_json(path, {"phases": ["old"]})

    def crash(src: str, dst: str) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(os, "replace", crash)
    with pytest.raises(OSError):
        write_json(path, {"phases": ["new"]})

    assert json.loads(path.read_text()) == {"phases": ["old"]}
    assert [p.name for p in path.parent.iterdir()] == [path.name]  # no temp file left


def test_an_unserialisable_value_never_touches_the_file(tmp_path: Path) -> None:
    path = tmp_path / "athletes.json"
    write_json(path, [])
    with pytest.raises(TypeError):
        write_json(path, [object()])
    assert path.read_text() == "[]\n"


def test_stats_and_article_index_share_one_format(tmp_path: Path) -> None:
    data = {"articles": [{"title": "Perché la trave è così difficile"}]}
    write_json(tmp_path / "stats.json", data)
    save_index(tmp_path, data)  # type: ignore[arg-type]
    assert (tmp_path / "stats.json").read_text() == (tmp_path / "index.json").read_text()
    assert "Perché" in (tmp_path / "index.json").read_text()  # UTF-8 kept, not \\u-escaped
