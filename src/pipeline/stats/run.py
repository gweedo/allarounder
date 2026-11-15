"""A stats run (issue #193): competitions.yaml + sources -> one JSON file per
verified competition under <out>/competitions/, the athletes.json registry,
and a Markdown report. A rejected competition writes nothing."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from domain.stats.model import Athlete, Competition, Phase, Result, Routine, TeamResult
from ingest.jsonfile import write_json
from stats.config import load_competitions
from stats.registry import AthleteRegistry, SlugCollision
from stats.verify import CompetitionRejected, Source, Verified, verify_competition


@dataclass(frozen=True)
class RunOutcome:
    ok: bool
    report: str


KINDS = {"TEAM": "team", "AA": "allAround", "VT": "vault"}  # anything else: one routine


def _routine(r: Routine) -> dict[str, float]:
    return {"d": r.d, "e": r.e, "penalty": r.penalty, "bonus": r.bonus}


def _detail(row: Result | TeamResult, slug: Callable[[Athlete], str]) -> dict[str, Any]:
    """Score detail, when a source gave it (#193: the kind never depends on it)."""
    if isinstance(row, TeamResult):
        members = [{"athlete": slug(m.athlete)} | ({"parts": m.parts} if m.parts else {}) for m in row.members]
        return ({"parts": row.parts} if row.parts else {}) | {"members": members}
    if row.routine:
        return _routine(row.routine)
    if row.vaults:
        return {"bonus": row.bonus, "vaults": [_routine(v) | {"total": v.total} for v in row.vaults]}
    return {"parts": row.parts} if row.parts else {}


def _row(row: Result | TeamResult, phase: Phase, registry: AthleteRegistry) -> dict[str, Any]:
    def slug(athlete: Athlete) -> str:
        return registry.resolve(athlete, phase.discipline)


    out: dict[str, Any] = {"kind": KINDS.get(phase.apparatus, "routine")}
    out |= {"nation": row.nation} if isinstance(row, TeamResult) else {"athlete": slug(row.athlete)}
    out |= {"rank": row.rank, "total": row.total, "verified": row.verified, "source": row.source}
    if row.detail_source:
        out["detailSource"] = row.detail_source
    return out | _detail(row, slug)


def _phase(phase: Phase, competition: Competition, registry: AthleteRegistry) -> dict[str, Any]:
    return {
        "round": phase.round, "discipline": phase.discipline, "apparatus": phase.apparatus,
        "medals": phase.round in competition.medals,
        # Wikipedia qualification tables list only qualifiers and reserves.
        "fieldComplete": "wg" in competition.sources or phase.round != "qualifica",
        "results": [_row(r, phase, registry) for r in phase.results],
    }


def _document(verified: Verified, registry: AthleteRegistry) -> dict[str, Any]:
    c = verified.competition
    return {
        "slug": c.slug, "name": c.name, "level": c.level, "tier": c.tier, "city": c.city, "country": c.country,
        "startDate": c.start_date, "endDate": c.end_date,
        "sources": {name: {"ref": ref, "revision": verified.revisions[name]} for name, ref in c.sources.items()},
        "phases": [_phase(p, c, registry) for p in c.phases],
    }


def _has_detail(row: Result | TeamResult) -> bool:
    if isinstance(row, TeamResult):
        return bool(row.parts)
    return bool(row.routine or row.vaults or row.parts)


def _section(verified: Verified) -> str:
    c = verified.competition
    lines = [f"## ✅ {c.slug}: written", ""]
    lines += [f"- {name} `{ref}` (revision `{verified.revisions[name]}`)" for name, ref in c.sources.items()]
    lines += ["", "| Phase | Rows | Verified | Unverified | With detail |", "|---|---|---|---|---|"]
    for phase in c.phases:
        rows = phase.results
        verified_rows = sum(r.verified for r in rows)
        lines.append(f"| {phase.round}/{phase.discipline}/{phase.apparatus} | {len(rows)} | {verified_rows} | "
                     f"{len(rows) - verified_rows} | {sum(_has_detail(r) for r in rows)} |")
    if verified.dropped:
        lines += ["", f"**Dropped Wikipedia rows ({len(verified.dropped)}):**", ""]
        lines += [f"- {d.phase}, {d.athlete}: {d.reason}" for d in verified.dropped]
    return "\n".join(lines) + "\n"


def run_stats(config: Path, sources: Mapping[str, Source], out: Path) -> RunOutcome:
    registry = AthleteRegistry.load(out / "athletes.json")
    sections: list[str] = []
    ok = True
    for competition in load_competitions(config):
        try:
            verified = verify_competition(competition, sources)
            draft = registry.copy()  # committed only if the whole competition serialises
            document = _document(verified, draft)
        except (CompetitionRejected, SlugCollision) as exc:
            ok = False
            sections.append(f"## ❌ {competition.slug}: rejected, nothing written\n\n{exc}\n")
            continue
        registry = draft
        # Registry first: an athlete with no results is allowed, a dangling reference is not (#199).
        write_json(out / "athletes.json", registry.entries())
        write_json(out / "competitions" / f"{competition.slug}.json", document)
        sections.append(_section(verified))
    return RunOutcome(ok=ok, report="# Stats run\n\n" + "\n".join(sections))
