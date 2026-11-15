"""Seam 4: a stats run. competitions.yaml + sources -> one JSON file per
competition, the athletes.json registry and a Markdown report. Sources are
in-memory fakes; output goes to a temp dir."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from domain.stats.model import (
    Athlete,
    Canary,
    Phase,
    Result,
    Routine,
    SourceResult,
    TeamMember,
    TeamResult,
)
from stats.config import ConfigError, load_competitions
from stats.run import run_stats

WORLDS_YAML = """\
- slug: mondiali-2026-rotterdam
  name: Campionati mondiali di ginnastica artistica 2026
  level: internazionale
  tier: Mondiali
  city: Rotterdam
  country: NED
  start_date: 2026-10-17
  end_date: 2026-10-25
  medals: [finale, finale-aa]
  sources:
    wg: 17247
    wikipedia: 2026_World_Artistic_Gymnastics_Championships
  canary: {phase: finale/MAG/FX, athlete: Fred Richard, total: 14.633}
"""


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "competitions.yaml"
    path.write_text(text, encoding="utf-8")
    return path


def test_loads_a_competition_with_sources_medals_and_canary(tmp_path: Path) -> None:
    [worlds] = load_competitions(write(tmp_path, WORLDS_YAML))

    assert worlds.slug == "mondiali-2026-rotterdam"
    assert (worlds.start_date, worlds.end_date) == ("2026-10-17", "2026-10-25")
    assert worlds.sources == {"wg": "17247", "wikipedia": "2026_World_Artistic_Gymnastics_Championships"}
    assert worlds.medals == ("finale", "finale-aa")
    assert worlds.canary == Canary(phase="finale/MAG/FX", athlete="Fred Richard", total=14.633)


@pytest.mark.parametrize(
    ("edit", "message"),
    [
        (lambda y: y.replace("mondiali-2026-rotterdam", "Mondiali 2026"), "slug"),
        (lambda y: y.replace("  medals: [finale, finale-aa]\n", ""), "medals"),
        (lambda y: y.replace("medals: [finale, finale-aa]", "medals: [semifinale]"), "medals"),
        (lambda y: y.split("  sources:")[0], "source"),
        (lambda y: y.replace("wg: 17247", "fig: 17247"), "source"),
        (lambda y: y.replace("phase: finale/MAG/FX", "phase: floor final"), "canary"),
        (lambda y: y.replace("  city: Rotterdam\n", ""), "city"),
        (lambda y: y + y, "duplicate"),
    ],
)
def test_rejects_an_invalid_competitions_file(tmp_path: Path, edit, message: str) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(ConfigError, match=message):
        load_competitions(write(tmp_path, edit(WORLDS_YAML)))


WIKI = "2026_World_Artistic_Gymnastics_Championships"
SIMPLE_YAML = WORLDS_YAML.replace("  canary: {phase: finale/MAG/FX, athlete: Fred Richard, total: 14.633}\n", "")
WIKI_ONLY_YAML = SIMPLE_YAML.replace("    wg: 17247\n", "")

WG_RICHARD = Athlete(name="Frederick RICHARD", nation="USA", wg_id=1001)
WG_JARMAN = Athlete(name="Jake JARMAN", nation="GBR", wg_id=1002)
RICHARD = Athlete(name="Fred Richard", nation="USA", wiki="Fred Richard")
RICHARD_FX = Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)


class FakeSource:
    def __init__(self, result: SourceResult | Exception) -> None:
        self.result = result

    def fetch(self, ref: str) -> SourceResult:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def fx_qual(*results: Result | TeamResult) -> Phase:
    return Phase(round="qualifica", discipline="MAG", apparatus="FX", results=results)


def sources(wg: tuple[Phase, ...] | None, wiki: tuple[Phase, ...] | None) -> dict[str, FakeSource]:
    out = {}
    if wg is not None:
        out["wg"] = FakeSource(SourceResult(source="wg", revision="wg-rev", phases=wg))
    if wiki is not None:
        out["wikipedia"] = FakeSource(SourceResult(source="wikipedia", revision="1385215085", phases=wiki))
    return out


def read(out: Path, name: str) -> dict:  # type: ignore[type-arg]
    return json.loads((out / name).read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def test_writes_one_file_per_competition_with_metadata_sources_and_rows(tmp_path: Path) -> None:
    out = tmp_path / "stats"
    outcome = run_stats(write(tmp_path, SIMPLE_YAML), sources(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633), Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.633, routine=RICHARD_FX)),),
    ), out)

    assert outcome.ok
    doc = read(out, "competitions/mondiali-2026-rotterdam.json")
    assert {k: doc[k] for k in ("slug", "name", "city", "startDate", "endDate")} == {
        "slug": "mondiali-2026-rotterdam", "name": "Campionati mondiali di ginnastica artistica 2026",
        "city": "Rotterdam", "startDate": "2026-10-17", "endDate": "2026-10-25"}
    assert doc["sources"] == {"wg": {"ref": "17247", "revision": "wg-rev"},
                              "wikipedia": {"ref": WIKI, "revision": "1385215085"}}
    [phase] = doc["phases"]
    assert {k: v for k, v in phase.items() if k != "results"} == {
        "round": "qualifica", "discipline": "MAG", "apparatus": "FX", "medals": False, "fieldComplete": True}
    assert phase["results"] == [
        {"kind": "routine", "athlete": "frederick-richard", "rank": 1, "total": 14.633, "verified": True,
         "source": "wg", "detailSource": "wikipedia", "d": 5.7, "e": 8.833, "penalty": 0.0, "bonus": 0.1},
        {"kind": "routine", "athlete": "jake-jarman", "rank": 2, "total": 14.6, "verified": True, "source": "wg"},
    ]


def test_every_row_has_a_kind_and_wikipedia_only_qualifications_are_partial(tmp_path: Path) -> None:
    v1 = Routine(d=5.6, e=9.2, penalty=0.0, total=14.8)
    v2 = Routine(d=5.2, e=9.3, penalty=0.1, total=14.4)
    team = TeamResult(nation="USA", rank=1, total=29.0, parts={"FX": 29.0}, members=(
        TeamMember(athlete=RICHARD, parts={"FX": 14.5}),
        TeamMember(athlete=Athlete(name="Brody Malone", nation="USA", wiki="Brody Malone"), parts={"FX": 14.5}),
        TeamMember(athlete=Athlete(name="Asher Hong", nation="USA", wiki="Asher Hong"), parts={}),
    ))
    out = tmp_path / "stats"
    run_stats(write(tmp_path, WIKI_ONLY_YAML), sources(None, (
        Phase(round="qualifica", discipline="MAG", apparatus="VT", results=(
            Result(athlete=RICHARD, rank=1, total=14.6, vaults=(v1, v2)),)),
        Phase(round="qualifica", discipline="MAG", apparatus="AA", results=(
            Result(athlete=RICHARD, rank=1, total=28.0, parts={"FX": 14.0, "PH": 14.0}),)),
        Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(team,)),
    )), out)

    vt, aa, tm = read(out, "competitions/mondiali-2026-rotterdam.json")["phases"]
    assert [p["fieldComplete"] for p in (vt, aa, tm)] == [False, False, False]
    assert vt["results"] == [{
        "kind": "vault", "athlete": "fred-richard", "rank": 1, "total": 14.6, "verified": False,
        "source": "wikipedia", "bonus": 0.0, "vaults": [
            {"d": 5.6, "e": 9.2, "penalty": 0.0, "bonus": 0.0, "total": 14.8},
            {"d": 5.2, "e": 9.3, "penalty": 0.1, "bonus": 0.0, "total": 14.4}]}]
    assert aa["results"] == [{
        "kind": "allAround", "athlete": "fred-richard", "rank": 1, "total": 28.0, "verified": False,
        "source": "wikipedia", "parts": {"FX": 14.0, "PH": 14.0}}]
    assert tm["results"] == [{
        "kind": "team", "nation": "USA", "rank": 1, "total": 29.0, "verified": False, "source": "wikipedia",
        "parts": {"FX": 29.0}, "members": [
            {"athlete": "fred-richard", "parts": {"FX": 14.5}},
            {"athlete": "brody-malone", "parts": {"FX": 14.5}},
            {"athlete": "asher-hong"}]}]


def test_phases_in_a_medal_round_award_medals(tmp_path: Path) -> None:
    final = Phase(round="finale", discipline="MAG", apparatus="FX", results=tuple(
        Result(athlete=Athlete(name=f"Gymnast {chr(65 + i)}", nation="ITA", wg_id=i), rank=i + 1, total=14.0 - i / 10)
        for i in range(8)))
    out = tmp_path / "stats"
    run_stats(write(tmp_path, SIMPLE_YAML.replace("    wikipedia: " + WIKI + "\n", "")),
              sources((final, fx_qual(final.results[0])), None), out)

    phases = read(out, "competitions/mondiali-2026-rotterdam.json")["phases"]
    assert [(p["round"], p["medals"], p["fieldComplete"]) for p in phases] == [
        ("finale", True, True), ("qualifica", False, True)]
    assert phases[0]["results"][0] == {"kind": "routine", "athlete": "gymnast-a", "rank": 1, "total": 14.0,
                                       "verified": True, "source": "wg"}


def test_athletes_json_registers_every_athlete_a_row_refers_to(tmp_path: Path) -> None:
    team = TeamResult(nation="USA", rank=1, total=14.633, parts={"FX": 14.633}, members=(
        TeamMember(athlete=RICHARD, parts={"FX": 14.633}),
        TeamMember(athlete=Athlete(name="Asher Hong", nation="USA", wiki="Asher Hong"), parts={}),))
    out = tmp_path / "stats"
    run_stats(write(tmp_path, WIKI_ONLY_YAML), sources(None, (
        fx_qual(Result(athlete=RICHARD, rank=1, total=14.633, routine=RICHARD_FX)),
        Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(team,)),
    )), out)

    assert read(out, "athletes.json") == [  # type: ignore[comparison-overlap]
        {"slug": "asher-hong", "name": "Asher Hong", "nation": "USA", "discipline": "MAG", "wiki": "Asher Hong"},
        {"slug": "fred-richard", "name": "Fred Richard", "nation": "USA", "discipline": "MAG", "wiki": "Fred Richard"},
    ]


def test_a_known_athlete_keeps_the_slug_already_in_the_registry(tmp_path: Path) -> None:
    """Slugs are locked once published: match the registry on the WG id, then
    on the Wikipedia title, and add any id the registry lacked."""
    out = tmp_path / "stats"
    out.mkdir()
    (out / "athletes.json").write_text(json.dumps([
        {"slug": "fred-richard", "name": "Fred Richard", "nation": "USA", "discipline": "MAG", "wiki": "Fred Richard"},
        {"slug": "jake-jarman", "name": "Jake Jarman", "nation": "GBR", "discipline": "MAG", "wgId": 1002},
    ]))
    merged_richard = Athlete(name="Frederick RICHARD", nation="USA", wg_id=1001, wiki="Fred Richard")
    run_stats(write(tmp_path, SIMPLE_YAML), {"wg": FakeSource(SourceResult(source="wg", revision="r", phases=(
        fx_qual(Result(athlete=merged_richard, rank=1, total=14.633), Result(athlete=WG_JARMAN, rank=2, total=14.6)),
    ))), "wikipedia": FakeSource(SourceResult(source="wikipedia", revision="1", phases=()))}, out)

    rows = read(out, "competitions/mondiali-2026-rotterdam.json")["phases"][0]["results"]
    assert [r["athlete"] for r in rows] == ["fred-richard", "jake-jarman"]
    assert read(out, "athletes.json") == [  # type: ignore[comparison-overlap]
        {"slug": "fred-richard", "name": "Fred Richard", "nation": "USA", "discipline": "MAG",
         "wiki": "Fred Richard", "wgId": 1001},
        {"slug": "jake-jarman", "name": "Jake Jarman", "nation": "GBR", "discipline": "MAG", "wgId": 1002},
    ]


class ByRef:
    """A source whose answer depends on the reference (several competitions)."""

    def __init__(self, results: dict[str, SourceResult | Exception]) -> None:
        self.results = results

    def fetch(self, ref: str) -> SourceResult:
        return FakeSource(self.results[ref]).fetch(ref)


EUROS_YAML = """\
- slug: europei-2026-antalya
  name: Campionati europei 2026
  level: internazionale
  tier: Europei
  city: Antalya
  country: TUR
  start_date: 2026-05-20
  end_date: 2026-05-25
  medals: [finale]
  sources: {wg: 99999}
"""


def test_a_rejected_competition_writes_nothing_and_fails_the_run(tmp_path: Path) -> None:
    from stats.sources import SourceError

    out = tmp_path / "stats"
    yaml_text = SIMPLE_YAML.replace("    wikipedia: " + WIKI + "\n", "") + EUROS_YAML
    outcome = run_stats(write(tmp_path, yaml_text), {"wg": ByRef({
        "17247": SourceError("unknown category 'Rope Climb'"),
        "99999": SourceResult(source="wg", revision="r", phases=(fx_qual(Result(athlete=WG_JARMAN, rank=1, total=14.6)),)),
    })}, out)

    assert not outcome.ok
    assert not (out / "competitions" / "mondiali-2026-rotterdam.json").exists()
    assert (out / "competitions" / "europei-2026-antalya.json").exists()
    assert "unknown category 'Rope Climb'" in outcome.report


def test_a_slug_collision_rejects_the_competition_and_leaves_the_registry_alone(tmp_path: Path) -> None:
    out = tmp_path / "stats"
    out.mkdir()
    registry = [{"slug": "jake-jarman", "name": "Jake Jarman", "nation": "AUS", "discipline": "MAG", "wgId": 7}]
    (out / "athletes.json").write_text(json.dumps(registry))
    outcome = run_stats(write(tmp_path, SIMPLE_YAML.replace("    wikipedia: " + WIKI + "\n", "")), sources(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633), Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        None), out)

    assert not outcome.ok
    assert "jake-jarman" in outcome.report
    assert json.loads((out / "athletes.json").read_text()) == registry
    assert not (out / "competitions").exists()


def test_the_report_lists_revisions_row_counts_and_dropped_rows(tmp_path: Path) -> None:
    jarman_wrong_total = Result(athlete=Athlete(name="Jake Jarman", nation="GBR", wiki="Jake Jarman"), rank=2,
                                total=14.7, routine=Routine(d=6.4, e=8.3, penalty=0.0, total=14.7))
    outcome = run_stats(write(tmp_path, SIMPLE_YAML), sources(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633), Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.633, routine=RICHARD_FX), jarman_wrong_total),),
    ), tmp_path / "stats")

    report = outcome.report
    assert "## ✅ mondiali-2026-rotterdam: written" in report
    assert "wg `17247` (revision `wg-rev`)" in report
    assert f"wikipedia `{WIKI}` (revision `1385215085`)" in report
    assert "| qualifica/MAG/FX | 2 | 2 | 0 | 1 |" in report  # rows, verified, unverified, with detail
    assert "- qualifica/MAG/FX, Jake Jarman (GBR): no official row with the same nation and total" in report


def test_the_committed_competitions_file_is_valid() -> None:
    from stats.cli import DEFAULT_CONFIG

    assert [c.slug for c in load_competitions(DEFAULT_CONFIG)] == ["mondiali-2026-rotterdam"]


def test_same_slug_same_nation_and_no_conflicting_id_is_the_same_athlete(tmp_path: Path) -> None:
    """Live 2026 Worlds: "Fusuke MAEDA" (WG id only, from a WG-only row) and
    "Fusuke Maeda" (Wikipedia title only, as a team member) are one person."""
    out = tmp_path / "stats"
    out.mkdir()
    (out / "athletes.json").write_text(json.dumps([
        {"slug": "fusuke-maeda", "name": "Fusuke MAEDA", "nation": "JPN", "discipline": "MAG", "wgId": 5}]))
    team = TeamResult(nation="JPN", rank=1, total=14.0, parts={"FX": 14.0}, members=(
        TeamMember(athlete=Athlete(name="Fusuke Maeda", nation="JPN", wiki="Fusuke Maeda"), parts={"FX": 14.0}),))
    outcome = run_stats(write(tmp_path, WIKI_ONLY_YAML), sources(None, (
        Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(team,)),)), out)

    assert outcome.ok, outcome.report
    assert read(out, "athletes.json") == [  # type: ignore[comparison-overlap]
        {"slug": "fusuke-maeda", "name": "Fusuke MAEDA", "nation": "JPN", "discipline": "MAG", "wgId": 5,
         "wiki": "Fusuke Maeda"}]
