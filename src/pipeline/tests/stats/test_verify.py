"""Seam 1: the competition verification module, driven by in-memory sources.

Source priority (issue #193): World Gymnastics ("wg") decides which rows exist
and their totals/ranks; Wikipedia only adds detail to the WG row it matches,
and a Wikipedia-only competition is published as `verified: false`.
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from domain.stats.model import (
    Athlete,
    Canary,
    Competition,
    Phase,
    Result,
    Routine,
    SourceResult,
    TeamMember,
    TeamResult,
)
from stats.verify import CompetitionRejected, SourceError, verify_competition


class FakeSource:
    """In-memory adapter: returns canned results keyed by source reference."""

    def __init__(self, results: dict[str, SourceResult]) -> None:
        self._results = results

    def fetch(self, ref: str) -> SourceResult:
        return self._results[ref]


def competition(**sources: str) -> Competition:
    return Competition(
        slug="mondiali-2026-rotterdam",
        name="Campionati mondiali di ginnastica artistica 2026",
        level="internazionale",
        tier="Mondiali",
        city="Rotterdam",
        country="NED",
        start_date="2026-10-17",
        end_date="2026-10-25",
        sources=sources,
    )


RICHARD = Athlete(name="Fred Richard", nation="USA", wiki="Fred Richard")
JARMAN = Athlete(name="Jake Jarman", nation="GBR", wiki="Jake Jarman")


def fx_final(*results: Result) -> Phase:
    return Phase(round="finale", discipline="MAG", apparatus="FX", results=results)


def fx_qual(*results: Result) -> Phase:
    """Qualification tables have no minimum size, so small fixtures are fine."""
    return Phase(round="qualifica", discipline="MAG", apparatus="FX", results=results)


def test_wikipedia_only_rows_keep_their_detail_but_are_unverified() -> None:
    wiki = SourceResult(
        source="wikipedia",
        revision="1385215085",
        phases=(
            fx_qual(
                Result(athlete=RICHARD, rank=1, total=14.633,
                       routine=Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)),
                Result(athlete=JARMAN, rank=2, total=14.6,
                       routine=Routine(d=6.3, e=8.3, penalty=0.0, total=14.6)),
            ),
        ),
    )

    out = verify_competition(
        competition(wikipedia="2026_World_Artistic_Gymnastics_Championships"),
        {"wikipedia": FakeSource({"2026_World_Artistic_Gymnastics_Championships": wiki})},
    )

    [phase] = out.competition.phases
    assert [(r.athlete.name, r.rank, r.total, r.verified) for r in phase.results] == [
        ("Fred Richard", 1, 14.633, False),
        ("Jake Jarman", 2, 14.6, False),
    ]
    assert phase.results[0].routine == Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)


WG_RICHARD = Athlete(name="Frederick RICHARD", nation="USA", wg_id=1001)
WG_JARMAN = Athlete(name="Jake JARMAN", nation="GBR", wg_id=1002)
WIKI_REF = "2026_World_Artistic_Gymnastics_Championships"


def both(wg_phases: tuple[Phase, ...], wiki_phases: tuple[Phase, ...]) -> dict[str, FakeSource]:
    return {
        "wg": FakeSource({"17247": SourceResult(source="wg", revision="2026-11-13", phases=wg_phases)}),
        "wikipedia": FakeSource({WIKI_REF: SourceResult(source="wikipedia", revision="1385215085",
                                                        phases=wiki_phases)}),
    }


def test_matched_wikipedia_row_adds_detail_to_the_official_row_and_is_verified() -> None:
    richard_routine = Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)
    sources = both(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633),
                  Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.633, routine=richard_routine)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [phase] = out.competition.phases
    richard, jarman = phase.results
    assert (richard.athlete.wg_id, richard.rank, richard.total, richard.verified) == (1001, 1, 14.633, True)
    assert richard.routine == richard_routine
    # Official row without a Wikipedia match: official numbers, no detail, still verified.
    assert (jarman.athlete.wg_id, jarman.rank, jarman.total, jarman.routine, jarman.verified) == (
        1002, 2, 14.6, None, True)


def test_wikipedia_row_without_an_official_match_is_dropped_and_reported() -> None:
    typo = Result(athlete=JARMAN, rank=2, total=14.06,  # official: 14.600
                  routine=Routine(d=6.3, e=7.76, penalty=0.0, total=14.06))
    sources = both(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633),
                  Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(typo),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    jarman = out.competition.phases[0].results[1]
    assert (jarman.total, jarman.routine) == (14.6, None)
    assert [(d.phase, d.athlete, d.reason) for d in out.dropped] == [
        ("qualifica/MAG/FX", "Jake Jarman (GBR)", "no official row with the same nation and total"),
    ]


def test_rank_disagreement_on_equal_score_still_matches_and_official_rank_wins() -> None:
    doi_routine = Routine(d=5.3, e=8.733, penalty=0.0, total=14.033)
    sources = both(
        (fx_qual(Result(athlete=Athlete(name="Ryosuke DOI", nation="JPN", wg_id=7), rank=7, total=14.033)),),
        (fx_qual(Result(athlete=Athlete(name="Ryosuke Doi", nation="JPN"), rank=8, total=14.033,
                         routine=doi_routine)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [doi] = out.competition.phases[0].results
    assert (doi.rank, doi.routine, doi.verified) == (7, doi_routine, True)
    assert out.dropped == ()


def test_full_tie_within_a_nation_is_resolved_by_name() -> None:
    # Two Koreans tied on 14.000 and rank 5; WG writes family names first in caps.
    yeo, hwang = (Routine(d=5.4, e=8.6, penalty=0.0, total=14.0), Routine(d=5.0, e=9.0, penalty=0.0, total=14.0))
    sources = both(
        (fx_qual(Result(athlete=Athlete(name="Seo-jeong YEO", nation="KOR", wg_id=1), rank=5, total=14.0),
                  Result(athlete=Athlete(name="Seo-hyun HWANG", nation="KOR", wg_id=2), rank=5, total=14.0)),),
        (fx_qual(Result(athlete=Athlete(name="Hwang Seo-hyun", nation="KOR"), rank=5, total=14.0, routine=hwang),
                  Result(athlete=Athlete(name="Yeo Seo-jeong", nation="KOR"), rank=5, total=14.0, routine=yeo)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    assert [(r.athlete.wg_id, r.routine) for r in out.competition.phases[0].results] == [(1, yeo), (2, hwang)]


def test_wikipedia_only_row_that_does_not_add_up_is_left_out_and_reported() -> None:
    wiki = SourceResult(source="wikipedia", revision="1385215085", phases=(
        fx_qual(
            Result(athlete=RICHARD, rank=1, total=14.633,
                   routine=Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)),
            Result(athlete=JARMAN, rank=2, total=14.6,
                   routine=Routine(d=6.3, e=8.0, penalty=0.0, total=14.6)),  # 6.3 + 8.0 = 14.3
        ),
    ))

    out = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert [r.athlete.name for r in out.competition.phases[0].results] == ["Fred Richard"]
    assert [(d.phase, d.athlete, d.reason) for d in out.dropped] == [
        ("qualifica/MAG/FX", "Jake Jarman (GBR)", "D + E + bonus - penalty = 14.300, total says 14.600"),
    ]


def test_matched_wikipedia_row_that_does_not_add_up_contributes_no_detail() -> None:
    sources = both(
        (fx_qual(Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(Result(athlete=JARMAN, rank=2, total=14.6,
                         routine=Routine(d=6.3, e=8.0, penalty=0.0, total=14.6))),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [jarman] = out.competition.phases[0].results
    assert (jarman.total, jarman.routine, jarman.verified) == (14.6, None, True)
    assert [d.reason for d in out.dropped] == ["D + E + bonus - penalty = 14.300, total says 14.600"]


def vt_qual(*results: Result) -> Phase:
    return Phase(round="qualifica", discipline="WAG", apparatus="VT", results=results)


def test_vault_rows_check_each_vault_and_the_average_plus_bonus() -> None:
    andrade = Athlete(name="Rebeca Andrade", nation="BRA")
    pease = Athlete(name="Claire Pease", nation="USA")
    good = Result(athlete=andrade, rank=1, total=14.466, bonus=0.2, vaults=(
        Routine(d=5.0, e=9.4, penalty=0.0, total=14.4), Routine(d=4.8, e=9.333, penalty=0.0, total=14.133)))
    bad_average = Result(athlete=pease, rank=2, total=14.5, bonus=0.2, vaults=(  # real: 14.233
        Routine(d=5.6, e=8.766, penalty=0.0, total=14.366), Routine(d=5.0, e=9.0, penalty=0.3, total=13.7)))
    wiki = SourceResult(source="wikipedia", revision="1", phases=(vt_qual(good, bad_average),))

    out = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert [r.athlete.name for r in out.competition.phases[0].results] == ["Rebeca Andrade"]
    assert [d.reason for d in out.dropped] == ["average of the vaults + bonus = 14.233, total says 14.500"]


def test_matched_vault_row_carries_both_vaults_and_bonus() -> None:
    vaults = (Routine(d=5.0, e=9.4, penalty=0.0, total=14.4), Routine(d=4.8, e=9.333, penalty=0.0, total=14.133))
    sources = both(
        (vt_qual(Result(athlete=Athlete(name="Rebeca ANDRADE", nation="BRA", wg_id=3), rank=1, total=14.466)),),
        (vt_qual(Result(athlete=Athlete(name="Rebeca Andrade", nation="BRA"), rank=1, total=14.466,
                         bonus=0.2, vaults=vaults)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [andrade] = out.competition.phases[0].results
    assert (andrade.vaults, andrade.bonus, andrade.verified) == (vaults, 0.2, True)


def test_all_around_row_whose_apparatus_scores_do_not_add_up_is_left_out() -> None:
    # Visser, 2026 Worlds WAG AA qualification: parts sum 53.965, Wikipedia total 51.965.
    blakely = Result(athlete=Athlete(name="Skye Blakely", nation="USA"), rank=2, total=55.465,
                     parts={"VT": 14.0, "UB": 14.333, "BB": 14.166, "FX": 12.966})
    visser = Result(athlete=Athlete(name="Naomi Visser", nation="NED"), rank=8, total=51.965,
                    parts={"VT": 13.0, "UB": 14.466, "BB": 13.266, "FX": 13.233})
    wiki = SourceResult(source="wikipedia", revision="1", phases=(
        Phase(round="qualifica", discipline="WAG", apparatus="AA", results=(blakely, visser)),))

    out = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert [r.athlete.name for r in out.competition.phases[0].results] == ["Skye Blakely"]
    assert [d.reason for d in out.dropped] == ["apparatus scores add up to 53.965, total says 51.965"]


def test_matched_all_around_row_carries_the_apparatus_breakdown() -> None:
    parts = {"FX": 13.666, "PH": 14.5, "SR": 13.9, "VT": 14.666, "PB": 14.7, "HB": 14.566}  # sums to 85.998
    sources = both(
        (Phase(round="qualifica", discipline="MAG", apparatus="AA", results=(
            Result(athlete=Athlete(name="Daiki HASHIMOTO", nation="JPN", wg_id=9), rank=1, total=85.998),)),),
        (Phase(round="qualifica", discipline="MAG", apparatus="AA", results=(
            Result(athlete=Athlete(name="Daiki Hashimoto", nation="JPN"), rank=1, total=85.998, parts=parts),)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [hashimoto] = out.competition.phases[0].results
    assert hashimoto.parts == parts


def test_team_rows_check_subtotals_against_total_and_against_the_best_three_members() -> None:
    def member(name: str, **scores: float) -> TeamMember:
        return TeamMember(athlete=Athlete(name=name, nation="USA"), parts=scores)

    members = (member("A", PB=13.5), member("B", PB=13.3), member("C", PB=13.265), member("D", PB=12.0))
    good = TeamResult(nation="JPN", rank=1, total=40.065, parts={"PB": 40.065}, members=(
        TeamMember(athlete=Athlete(name="J1", nation="JPN"), parts={"PB": 13.5}),
        TeamMember(athlete=Athlete(name="J2", nation="JPN"), parts={"PB": 13.3}),
        TeamMember(athlete=Athlete(name="J3", nation="JPN"), parts={"PB": 13.265}),
    ))
    usa_typo = TeamResult(nation="USA", rank=2, total=50.065, parts={"PB": 50.065}, members=members)
    wiki = SourceResult(source="wikipedia", revision="1", phases=(
        Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(good, usa_typo)),))

    out = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert [r.nation for r in out.competition.phases[0].results] == ["JPN"]
    assert [(d.athlete, d.reason) for d in out.dropped] == [
        ("USA", "PB: best three members add up to 40.065, subtotal says 50.065"),
    ]


def test_matched_team_row_carries_subtotals_and_members() -> None:
    members = tuple(TeamMember(athlete=Athlete(name=n, nation="JPN"), parts={"PB": s})
                    for n, s in (("J1", 13.5), ("J2", 13.3), ("J3", 13.265)))
    sources = both(
        (Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(
            TeamResult(nation="JPN", rank=1, total=40.065, parts={}),)),),
        (Phase(round="qualifica", discipline="MAG", apparatus="TEAM", results=(
            TeamResult(nation="JPN", rank=1, total=40.065, parts={"PB": 40.065}, members=members),)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    [japan] = out.competition.phases[0].results
    assert isinstance(japan, TeamResult)
    assert (japan.parts, japan.members, japan.verified) == ({"PB": 40.065}, members, True)


class BrokenSource:
    def fetch(self, ref: str) -> SourceResult:
        raise SourceError("finale/MAG/FX: unknown nation 'Atlantis'")


def test_a_source_layout_error_rejects_the_whole_competition() -> None:
    with pytest.raises(CompetitionRejected) as rejected:
        verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": BrokenSource()})

    assert str(rejected.value) == (
        "mondiali-2026-rotterdam: wikipedia source failed: finale/MAG/FX: unknown nation 'Atlantis'"
    )


def test_a_final_with_missing_rows_rejects_the_whole_competition() -> None:
    eight = tuple(Result(athlete=Athlete(name=f"G{i}", nation="ITA"), rank=i, total=14.0 - i / 10,
                         routine=Routine(d=5.0, e=9.0 - i / 10, penalty=0.0, total=14.0 - i / 10))
                  for i in range(1, 9))
    one_bad = (*eight[:7], replace(eight[7], routine=Routine(d=5.0, e=1.0, penalty=0.0, total=eight[7].total)))
    wiki = SourceResult(source="wikipedia", revision="1", phases=(fx_final(*one_bad),))

    with pytest.raises(CompetitionRejected) as rejected:
        verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert str(rejected.value) == "mondiali-2026-rotterdam: finale/MAG/FX has 7 rows, a final needs 8"


def test_a_complete_final_passes_the_row_count_check() -> None:
    eight = tuple(Result(athlete=Athlete(name=f"G{i}", nation="ITA"), rank=i, total=14.0)
                  for i in range(1, 9))
    wiki = SourceResult(source="wikipedia", revision="1", phases=(fx_final(*eight),))

    out = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: wiki})})

    assert len(out.competition.phases[0].results) == 8


def _eight_fx_final(winner_total: float) -> SourceResult:
    rows = (Result(athlete=RICHARD, rank=1, total=winner_total),
            *(Result(athlete=Athlete(name=f"G{i}", nation="ITA"), rank=i, total=14.0) for i in range(2, 9)))
    return SourceResult(source="wikipedia", revision="1", phases=(fx_final(*rows),))


CANARY = Canary(phase="finale/MAG/FX", athlete="Fred Richard", total=14.633)


def test_wikipedia_only_competition_is_rejected_when_the_canary_row_is_wrong() -> None:
    comp = replace(competition(wikipedia=WIKI_REF), canary=CANARY)

    with pytest.raises(CompetitionRejected) as rejected:
        verify_competition(comp, {"wikipedia": FakeSource({WIKI_REF: _eight_fx_final(14.6)})})

    assert str(rejected.value) == (
        "mondiali-2026-rotterdam: canary failed: Fred Richard in finale/MAG/FX expected 14.633, found 14.600"
    )


def test_wikipedia_only_competition_passes_when_the_canary_row_matches() -> None:
    comp = replace(competition(wikipedia=WIKI_REF), canary=CANARY)

    out = verify_competition(comp, {"wikipedia": FakeSource({WIKI_REF: _eight_fx_final(14.633)})})

    assert out.competition.phases[0].results[0].total == 14.633


def test_wikipedia_phase_missing_from_official_data_is_dropped_and_reported() -> None:
    sources = both(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.7)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.7)),
         Phase(round="qualifica", discipline="MAG", apparatus="PH", results=(
             Result(athlete=JARMAN, rank=1, total=14.9),))),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    assert [p.apparatus for p in out.competition.phases] == ["FX"]
    assert [(d.phase, d.athlete, d.reason) for d in out.dropped] == [
        ("qualifica/MAG/PH", "Jake Jarman (GBR)", "no official row with the same nation and total"),
    ]


def test_result_records_the_source_revisions_it_was_built_from() -> None:
    sources = both((fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.7)),), ())

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    assert out.revisions == {"wg": "2026-11-13", "wikipedia": "1385215085"}


def test_merged_athlete_keeps_both_the_official_id_and_the_wikipedia_title() -> None:
    sources = both(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.7)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.7)),),
    )

    out = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources)

    assert out.competition.phases[0].results[0].athlete == Athlete(
        name="Frederick RICHARD", nation="USA", wiki="Fred Richard", wg_id=1001)


def test_rows_record_their_source_and_where_their_detail_came_from() -> None:
    """Merged rows carry Wikipedia (CC BY-SA) detail: the page must credit it."""
    routine = Routine(d=5.7, e=8.833, penalty=0.0, bonus=0.1, total=14.633)
    merged = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), both(
        (fx_qual(Result(athlete=WG_RICHARD, rank=1, total=14.633), Result(athlete=WG_JARMAN, rank=2, total=14.6)),),
        (fx_qual(Result(athlete=RICHARD, rank=1, total=14.633, routine=routine)),),
    ))
    wiki_only = verify_competition(competition(wikipedia=WIKI_REF), {"wikipedia": FakeSource({WIKI_REF: SourceResult(
        source="wikipedia", revision="1", phases=(fx_qual(Result(athlete=RICHARD, rank=1, total=14.633,
                                                                 routine=routine)),))})})

    richard, jarman = merged.competition.phases[0].results
    [wiki_richard] = wiki_only.competition.phases[0].results
    assert (richard.source, richard.detail_source) == ("wg", "wikipedia")
    assert (jarman.source, jarman.detail_source) == ("wg", None)
    assert (wiki_richard.source, wiki_richard.detail_source) == ("wikipedia", None)


def test_merged_team_members_keep_their_official_ids() -> None:
    """Live 2026 Worlds: WG lists "Siyu DU", Wikipedia "Du Siyu". Members are
    paired by name in any word order; one member left on each side is the same
    person ("Rebecca DOWNIE" / "Becky Downie")."""
    wg_du, wg_downie = Athlete(name="Siyu DU", nation="CHN", wg_id=11), Athlete(name="Rebecca DOWNIE", nation="CHN",
                                                                                   wg_id=12)
    wiki_du, wiki_downie = Athlete(name="Du Siyu", nation="CHN", wiki="Du Siyu"), Athlete(
        name="Becky Downie", nation="CHN", wiki="Becky Downie")
    sources = both(
        (Phase(round="qualifica", discipline="WAG", apparatus="TEAM", results=(
            TeamResult(nation="CHN", rank=1, total=27.0, parts={}, members=(
                TeamMember(athlete=wg_downie, parts={}), TeamMember(athlete=wg_du, parts={}))),)),),
        (Phase(round="qualifica", discipline="WAG", apparatus="TEAM", results=(
            TeamResult(nation="CHN", rank=1, total=27.0, parts={"BB": 27.0}, members=(
                TeamMember(athlete=wiki_du, parts={"BB": 13.5}), TeamMember(athlete=wiki_downie, parts={"BB": 13.5}),
            )),)),),
    )

    [china] = verify_competition(competition(wg="17247", wikipedia=WIKI_REF), sources).competition.phases[0].results

    assert isinstance(china, TeamResult)
    assert [(m.athlete, m.parts) for m in china.members] == [
        (replace(wg_du, wiki="Du Siyu"), {"BB": 13.5}),
        (replace(wg_downie, wiki="Becky Downie"), {"BB": 13.5}),
    ]
