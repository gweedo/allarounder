"""Competition verification module (issue #193).

The one place that applies the source-priority rule: fetch each configured
source, merge on World Gymnastics, verify Wikipedia rows, and return one
verified competition (or reject it as a whole).
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from typing import Protocol

from domain.stats.model import (
    Competition,
    Phase,
    Result,
    Routine,
    SourceResult,
    TeamResult,
)


class SourceError(Exception):
    """Raised by a source adapter when its input no longer has the expected
    shape (unknown nation, missing column, too few rows...). Always fatal."""


class CompetitionRejected(Exception):
    """The competition can't be published at all; nothing should be written."""


class Source(Protocol):
    def fetch(self, ref: str) -> SourceResult: ...


@dataclass(frozen=True)
class Dropped:
    """A backup row left out of the output, and why (goes in the run report)."""

    phase: str
    athlete: str
    reason: str


@dataclass(frozen=True)
class Verified:
    competition: Competition
    dropped: tuple[Dropped, ...] = field(default_factory=tuple)
    revisions: dict[str, str] = field(default_factory=dict)  # source name -> revision used


def _key(phase: Phase) -> tuple[str, str, str]:
    return (phase.round, phase.discipline, phase.apparatus)


Row = Result | TeamResult


def _nation(row: Row) -> str:
    return row.nation if isinstance(row, TeamResult) else row.athlete.nation


def _name(row: Row) -> str:
    return row.nation if isinstance(row, TeamResult) else row.athlete.name


def _matches(official: Row, backup: Row) -> bool:
    """Nation + exact total. Rank is a preference, not a requirement: a
    tie-break can rank equal scores differently (official rank wins)."""
    return (
        type(official) is type(backup)
        and _nation(official) == _nation(backup)
        and round(official.total, 3) == round(backup.total, 3)
    )


def _name_tokens(name: str) -> frozenset[str]:
    """Order- and case-free: "Seo-jeong YEO" and "Yeo Seo-jeong" are equal."""
    ascii_only = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return frozenset(re.findall(r"[a-z]+", ascii_only.lower()))


def _best_match(official: Row, candidates: list[Row]) -> Row | None:
    found = [b for b in candidates if _matches(official, b)]
    same_rank = [b for b in found if b.rank == official.rank] or found
    same_name = [b for b in same_rank if _name_tokens(_name(b)) == _name_tokens(_name(official))]
    best = same_name or same_rank
    return best[0] if best else None


def _detail_of(backup: Row) -> dict:
    """What a verified backup row may add to the official row: score detail only."""
    if isinstance(backup, TeamResult):
        return {"parts": backup.parts, "members": backup.members}
    return {"routine": backup.routine, "vaults": backup.vaults, "bonus": backup.bonus,
            "parts": backup.parts}


def _with_detail(official: Row, backup: Row | None) -> Row:
    if backup is None:
        return replace(official, verified=True)
    merged = replace(official, **_detail_of(backup), verified=True)
    if isinstance(merged, Result) and isinstance(backup, Result) and backup.athlete.wiki:
        merged = replace(merged, athlete=replace(merged.athlete, wiki=backup.athlete.wiki))  # identity alias
    return merged


def _label(phase: Phase) -> str:
    return "/".join(_key(phase))


TOLERANCE = 0.0011  # scores are truncated to 3 decimals; allow one unit of drift


def _routine_problem(r: Routine) -> str | None:
    calc = r.d + r.e + r.bonus - r.penalty
    if abs(calc - r.total) > TOLERANCE:
        return f"D + E + bonus - penalty = {calc:.3f}, total says {r.total:.3f}"
    return None


def _team_problem(team: TeamResult) -> str | None:
    calc = sum(team.parts.values())
    if abs(calc - team.total) > TOLERANCE * len(team.parts):
        return f"apparatus subtotals add up to {calc:.3f}, total says {team.total:.3f}"
    for apparatus, subtotal in team.parts.items():
        scores = sorted((score for m in team.members for app, score in m.parts.items() if app == apparatus),
                        reverse=True)
        best = sum(scores[:3])
        if abs(best - subtotal) > TOLERANCE * 3:
            return f"{apparatus}: best three members add up to {best:.3f}, subtotal says {subtotal:.3f}"
    return None


def _arithmetic_problem(row: Result | TeamResult) -> str | None:
    if isinstance(row, TeamResult):
        return _team_problem(row)
    if row.routine is not None:
        return _routine_problem(row.routine)
    if row.vaults:
        for vault in row.vaults:
            if problem := _routine_problem(vault):
                return problem
        calc = sum(v.total for v in row.vaults) / len(row.vaults) + row.bonus
        if abs(calc - row.total) > TOLERANCE:
            return f"average of the vaults + bonus = {calc:.3f}, total says {row.total:.3f}"
    if row.parts:
        calc = sum(row.parts.values())
        if abs(calc - row.total) > TOLERANCE * len(row.parts):
            return f"apparatus scores add up to {calc:.3f}, total says {row.total:.3f}"
    return None


def _who(row: Result | TeamResult) -> str:
    if isinstance(row, TeamResult):
        return row.nation
    return f"{row.athlete.name} ({row.athlete.nation})"


def _screen(phase: Phase, dropped: list[Dropped]) -> Phase:
    """Remove backup rows that contradict themselves, reporting each one."""
    kept = []
    for row in phase.results:
        problem = _arithmetic_problem(row)
        if problem:
            dropped.append(Dropped(phase=_label(phase), athlete=_who(row), reason=problem))
        else:
            kept.append(row)
    return replace(phase, results=tuple(kept))


def _merge_phase(official: Phase, backup: Phase | None, dropped: list[Dropped]) -> Phase:
    candidates = list(backup.results) if backup else []
    merged = []
    for row in official.results:
        match = _best_match(row, candidates)
        if match:
            candidates.remove(match)
        merged.append(_with_detail(row, match))
    for left in candidates:
        dropped.append(Dropped(phase=_label(official), athlete=_who(left),
                               reason="no official row with the same nation and total"))
    return replace(official, results=tuple(merged))


# A final always has this many rows; fewer means a missing or rejected row,
# which would make medals and leaderboards silently wrong. Qualification
# tables vary (Wikipedia lists qualifiers only), so they have no minimum.
FINAL_SIZE = {"AA": 24, "TEAM": 8}
APPARATUS_FINAL_SIZE = 8


def _check_complete(competition: Competition, phases: tuple[Phase, ...]) -> None:
    for phase in phases:
        if not phase.round.startswith("finale"):
            continue
        needed = FINAL_SIZE.get(phase.apparatus, APPARATUS_FINAL_SIZE)
        if len(phase.results) < needed:
            raise CompetitionRejected(
                f"{competition.slug}: {_label(phase)} has {len(phase.results)} rows, a final needs {needed}")


def _check_canary(competition: Competition, phases: tuple[Phase, ...]) -> None:
    canary = competition.canary
    if canary is None:
        return
    phase = next((p for p in phases if _label(p) == canary.phase), None)
    row = next((r for r in phase.results if _name(r) == canary.athlete), None) if phase else None
    found = f"{row.total:.3f}" if row else "no such row"
    if row is None or round(row.total, 3) != round(canary.total, 3):
        raise CompetitionRejected(
            f"{competition.slug}: canary failed: {canary.athlete} in {canary.phase} "
            f"expected {canary.total:.3f}, found {found}")


def _verified(competition: Competition, phases: tuple[Phase, ...], dropped: list[Dropped],
              fetched: Mapping[str, SourceResult]) -> Verified:
    return Verified(competition=replace(competition, phases=phases), dropped=tuple(dropped),
                    revisions={name: result.revision for name, result in fetched.items()})


def verify_competition(competition: Competition, sources: Mapping[str, Source]) -> Verified:
    fetched = {}
    for name, ref in competition.sources.items():
        try:
            fetched[name] = sources[name].fetch(ref)
        except SourceError as exc:
            raise CompetitionRejected(f"{competition.slug}: {name} source failed: {exc}") from exc
    wiki = fetched.get("wikipedia")
    dropped: list[Dropped] = []
    if "wg" not in fetched:
        assert wiki is not None
        phases = tuple(_screen(p, dropped) for p in wiki.phases)
        _check_complete(competition, phases)
        _check_canary(competition, phases)
        return _verified(competition, phases, dropped, fetched)
    backup_by_key = {_key(p): _screen(p, dropped) for p in wiki.phases} if wiki else {}
    official = fetched["wg"].phases
    phases = tuple(_merge_phase(p, backup_by_key.pop(_key(p), None), dropped) for p in official)
    for orphan in backup_by_key.values():  # phases the official data doesn't have
        _merge_phase(replace(orphan, results=()), orphan, dropped)
    _check_complete(competition, phases)
    return _verified(competition, phases, dropped, fetched)
