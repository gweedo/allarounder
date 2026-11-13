"""Seam 2: the Wikipedia source adapter, against the real saved 2026 Worlds
article (revision 1385215085, CC BY-SA; see fixtures/README.md) served by a
fake HTTP client. No network."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from domain.stats.model import (
    Athlete,
    Competition,
    Phase,
    Result,
    Routine,
    SourceResult,
    TeamResult,
)
from stats.sources import SourceError
from stats.sources.wikipedia import WikipediaSource
from stats.verify import CompetitionRejected, verify_competition

FIXTURES = Path(__file__).parent / "fixtures"
PAGE = "2026_World_Artistic_Gymnastics_Championships"


class FakeWikipedia:
    """Answers action=parse from the saved page and action=query from the
    recorded redirects, like the MediaWiki API would."""

    def __init__(self) -> None:
        self.parse = json.loads((FIXTURES / "wikipedia-worlds-2026-parse.json").read_text())
        self.redirects = json.loads((FIXTURES / "wikipedia-worlds-2026-redirects.json").read_text())
        self.calls: list[dict[str, str]] = []

    def get_json(self, url: str, params: dict[str, str]) -> Any:
        assert url == "https://en.wikipedia.org/w/api.php"
        self.calls.append(params)
        if params["action"] == "parse":
            assert params["page"] == PAGE
            return self.parse
        titles = params["titles"].split("|")
        return {"query": {"redirects": [{"from": t, "to": self.redirects[t]}
                                        for t in titles if t in self.redirects]}}


@pytest.fixture(scope="module")
def worlds() -> SourceResult:
    return WikipediaSource(FakeWikipedia()).fetch(PAGE)


def test_returns_every_final_and_qualification_phase_tagged_with_the_revision(worlds: SourceResult) -> None:
    labels = [f"{p.round}/{p.discipline}/{p.apparatus}" for p in worlds.phases]

    assert (worlds.source, worlds.revision) == ("wikipedia", "1385215085")
    assert labels == [
        "finale/MAG/TEAM", "finale-aa/MAG/AA", "finale/MAG/FX", "finale/MAG/PH", "finale/MAG/SR",
        "finale/MAG/VT", "finale/MAG/PB", "finale/MAG/HB",
        "finale/WAG/TEAM", "finale-aa/WAG/AA", "finale/WAG/VT", "finale/WAG/UB", "finale/WAG/BB",
        "finale/WAG/FX",
        "qualifica/MAG/TEAM", "qualifica/MAG/AA", "qualifica/MAG/FX", "qualifica/MAG/PH",
        "qualifica/MAG/SR", "qualifica/MAG/VT", "qualifica/MAG/PB", "qualifica/MAG/HB",
        "qualifica/WAG/TEAM", "qualifica/WAG/AA", "qualifica/WAG/VT", "qualifica/WAG/UB",
        "qualifica/WAG/BB", "qualifica/WAG/FX",
    ]


def phase(worlds: SourceResult, label: str) -> Phase:
    return next(p for p in worlds.phases if f"{p.round}/{p.discipline}/{p.apparatus}" == label)


def test_apparatus_final_rows_carry_rank_athlete_nation_and_routine(worlds: SourceResult) -> None:
    fx = phase(worlds, "finale/MAG/FX")
    ph = phase(worlds, "finale/MAG/PH")

    assert len(fx.results) == 8
    assert fx.results[0] == Result(
        athlete=Athlete(name="Fred Richard", nation="USA", wiki="Fred Richard"), rank=1, total=14.633,
        routine=Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633))
    # Pommel horse has no bonus column; Targhetta won silver for Italy.
    targhetta = ph.results[1]
    assert (targhetta.athlete.name, targhetta.athlete.nation, targhetta.rank) == ("Gabriele Targhetta", "ITA", 2)
    assert targhetta.routine == Routine(d=5.9, e=9.333, penalty=0.0, total=15.233)


def test_vault_finals_keep_both_vaults_with_per_vault_or_result_bonus(worlds: SourceResult) -> None:
    davtyan = phase(worlds, "finale/MAG/VT").results[0]
    andrade = phase(worlds, "finale/WAG/VT").results[0]

    assert (davtyan.athlete.name, davtyan.rank, davtyan.total, davtyan.bonus) == ("Artur Davtyan", 1, 14.85, 0.0)
    assert davtyan.vaults == (Routine(d=5.2, e=9.5, penalty=0.0, bonus=0.1, total=14.8),
                              Routine(d=5.2, e=9.6, penalty=0.0, bonus=0.1, total=14.9))
    assert (andrade.athlete.nation, andrade.total, andrade.bonus) == ("BRA", 14.466, 0.2)
    assert andrade.vaults == (Routine(d=5.0, e=9.4, penalty=0.0, total=14.4),
                              Routine(d=4.8, e=9.333, penalty=0.0, total=14.133))


def test_all_around_rows_carry_apparatus_scores_in_header_order(worlds: SourceResult) -> None:
    hashimoto = phase(worlds, "finale-aa/MAG/AA").results[0]
    blakely = phase(worlds, "finale-aa/WAG/AA").results[0]

    assert (hashimoto.athlete.name, hashimoto.rank, hashimoto.total) == ("Daiki Hashimoto", 1, 85.998)
    assert hashimoto.parts == {"FX": 13.666, "PH": 14.5, "SR": 13.9, "VT": 14.666, "PB": 14.7, "HB": 14.766}
    assert blakely.parts == {"VT": 14.2, "UB": 14.4, "BB": 14.2, "FX": 12.933}
    assert len(phase(worlds, "finale-aa/WAG/AA").results) == 24


def test_team_rows_carry_subtotals_and_each_members_scores(worlds: SourceResult) -> None:
    teams = phase(worlds, "finale/MAG/TEAM").results
    japan = teams[0]

    assert len(teams) == 8
    assert isinstance(japan, TeamResult)
    assert (japan.nation, japan.rank, japan.total) == ("JPN", 1, 251.928)
    assert japan.parts == {"FX": 41.299, "PH": 42.332, "SR": 40.933, "VT": 42.966, "PB": 42.099, "HB": 42.299}
    doi = japan.members[0]
    assert (doi.athlete.name, doi.athlete.nation, doi.parts) == (
        "Ryosuke Doi", "JPN", {"FX": 13.733, "PH": 14.1, "VT": 14.2})


def test_tied_rows_sharing_rowspan_cells_are_both_kept(worlds: SourceResult) -> None:
    rows = phase(worlds, "qualifica/MAG/FX").results
    tied = [(r.athlete.name, r.rank, r.total) for r in rows if r.rank == 9]

    assert tied == [("Illia Kovtun", 9, 14.0), ("Danila Leykin", 9, 14.0)]


def test_athlete_wiki_titles_are_resolved_through_redirects() -> None:
    http = FakeWikipedia()
    worlds = WikipediaSource(http).fetch(PAGE)
    titles = {r.athlete.wiki for p in worlds.phases for r in p.results if isinstance(r, Result)}
    member_titles = {m.athlete.wiki for p in worlds.phases for r in p.results
                     if isinstance(r, TeamResult) for m in r.members}

    assert "Alena Glotova" in titles and "Alyona Glotova" not in titles | member_titles
    assert "Fred Richard" in titles and "Frederick Richard" not in titles | member_titles
    # Batched politely: one parse request, then at most 50 titles per query.
    queries = [c for c in http.calls if c["action"] == "query"]
    assert all(len(c["titles"].split("|")) <= 50 for c in queries) and len(queries) >= 1


@pytest.mark.parametrize(("find", "replace_with", "message"), [
    ('title="Belarus"', 'title="Atlantis"', "unknown nation 'Atlantis'"),
    ("<b>14.633</b>", "<b>n/a</b>", "not a score: 'n/a'"),
])
def test_layout_drift_raises_a_source_error(find: str, replace_with: str, message: str) -> None:
    http = FakeWikipedia()
    assert find in http.parse["parse"]["text"]
    http.parse["parse"]["text"] = http.parse["parse"]["text"].replace(find, replace_with)

    with pytest.raises(SourceError, match=message):
        WikipediaSource(http).fetch(PAGE)


def test_real_cell_quirks_parse_decimal_comma_and_broken_subtotal(worlds: SourceResult) -> None:
    scott = next(r for r in phase(worlds, "qualifica/WAG/AA").results
                 if isinstance(r, Result) and r.athlete.name == "Breanna Scott")
    usa = next(t for t in phase(worlds, "qualifica/MAG/TEAM").results
               if isinstance(t, TeamResult) and t.nation == "USA")

    assert scott.total == 52.698  # written "52,698"
    assert usa.parts["PB"] == 50.065  # written "50.065 16)"; the number itself is a typo for 40.065


def test_real_page_alone_is_rejected_because_two_finals_contradict_themselves() -> None:
    comp = Competition(slug="mondiali-2026-rotterdam", name="Mondiali 2026", level="internazionale",
                       tier="Mondiali", city="Rotterdam", country="NED", start_date="2026-10-17",
                       end_date="2026-10-25", sources={"wikipedia": PAGE})

    with pytest.raises(CompetitionRejected, match=r"finale/MAG/TEAM has 7 rows, a final needs 8"):
        verify_competition(comp, {"wikipedia": WikipediaSource(FakeWikipedia())})
