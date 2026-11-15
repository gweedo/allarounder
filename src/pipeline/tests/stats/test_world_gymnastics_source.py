"""Seam 3: the World Gymnastics source adapter, against real recorded
responses for event 17247 (see fixtures/README.md) served by a fake HTTP
client. No network."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from domain.stats.model import Phase, Result, SourceResult, TeamResult
from stats.sources import SourceError
from stats.sources.world_gymnastics import WorldGymnasticsSource

FIXTURES = Path(__file__).parent / "fixtures" / "wg-17247"
BASE = "https://www.gymnastics.sport/api/sportevents/"


class FakeWorldGymnastics:
    def __init__(self) -> None:
        self.responses: dict[str, Any] = json.loads((FIXTURES / "responses.json").read_text())

    def get_json(self, url: str, params: dict[str, str]) -> Any:
        assert url.startswith(BASE)
        key = url.removeprefix(BASE)
        if params:
            key += "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        return self.responses[key]


@pytest.fixture(scope="module")
def worlds() -> SourceResult:
    return WorldGymnasticsSource(FakeWorldGymnastics()).fetch("17247")


def label(p: Phase) -> str:
    return f"{p.round}/{p.discipline}/{p.apparatus}"


def test_returns_qualification_and_final_phases_for_both_disciplines(worlds: SourceResult) -> None:
    labels = {label(p) for p in worlds.phases}

    assert worlds.source == "wg"
    assert len(worlds.revision) == 12  # content hash: changes when any number changes
    assert labels == {
        f"{rnd}/MAG/{app}" for rnd in ("qualifica", "finale") for app in ("FX", "PH", "SR", "VT", "PB", "HB", "TEAM")
    } | {f"{rnd}/WAG/{app}" for rnd in ("qualifica", "finale") for app in ("VT", "UB", "BB", "FX", "TEAM")} | {
        "qualifica/MAG/AA", "finale-aa/MAG/AA", "qualifica/WAG/AA", "finale-aa/WAG/AA"}


def test_rows_carry_official_rank_total_nation_and_gymnast_id(worlds: SourceResult) -> None:
    by_label = {label(p): p for p in worlds.phases}
    richard = by_label["finale/MAG/FX"].results[0]
    japan = by_label["finale/MAG/TEAM"].results[0]

    assert isinstance(richard, Result)
    assert (richard.rank, richard.total, richard.athlete.nation, richard.athlete.name) == (
        1, 14.633, "USA", "Frederick RICHARD")
    assert richard.athlete.wg_id is not None
    assert isinstance(japan, TeamResult)
    assert (japan.nation, japan.rank, japan.total, japan.members[0].athlete.wg_id) == ("JPN", 1, 251.928, 58869)
    assert len(by_label["qualifica/MAG/AA"].results) == 102  # every all-around finisher, ranks 1-102


def _drifted(edit: Any) -> FakeWorldGymnastics:
    fake = FakeWorldGymnastics()
    edit(fake.responses)
    return fake


FX = "17247/results/?ageCategory=2&category=58"


@pytest.mark.parametrize(
    ("case", "edit"),
    [
        ("unknown category", lambda r: r["17247/categories/?idDiscipline=2"]["data"].append(
            {"id": 99, "name": "Rope Climb"})),
        ("missing nation", lambda r: r[FX]["data"][0].pop("country")),
        ("missing gymnasts", lambda r: r[FX]["data"][0].pop("gymnasts")),
        ("score is not a number", lambda r: r[FX]["data"][0].update(scorefinal="14,633")),
        ("rank is not a number", lambda r: r[FX]["data"][0].update(rankfinal=None)),
        ("no data envelope", lambda r: r.update({FX: {"error": "maintenance"}})),
        ("individual row with two gymnasts", lambda r: r[FX]["data"][0]["gymnasts"].append(
            {"id": 1, "firstname": "A", "lastname": "B"})),
    ],
)
def test_unexpected_feed_data_raises_source_error(case: str, edit: Any) -> None:
    with pytest.raises(SourceError):
        WorldGymnasticsSource(_drifted(edit)).fetch("17247")
