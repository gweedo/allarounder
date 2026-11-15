"""Stats value objects (issue #193). Framework-free (ADR-0008).

A Competition has Phases (round × discipline × apparatus); each Phase has
Results. A SourceResult is what one source adapter returns for one competition.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Athlete:
    """Identity hints as a source reports them; the slug is assigned later."""

    name: str
    nation: str
    wiki: str | None = None
    wg_id: int | None = None


@dataclass(frozen=True)
class Routine:
    d: float
    e: float
    penalty: float
    total: float
    bonus: float = 0.0


@dataclass(frozen=True)
class Result:
    athlete: Athlete
    rank: int
    total: float
    routine: Routine | None = None
    vaults: tuple[Routine, ...] | None = None  # vault finals: two vaults, averaged
    bonus: float = 0.0  # result-level bonus (women's vault)
    parts: dict[str, float] | None = None  # all-around: apparatus -> score, in order
    verified: bool = False
    source: str = ""  # set by verification: "wg" or "wikipedia"
    detail_source: str | None = None  # where the score detail came from, if not `source`


@dataclass(frozen=True)
class TeamMember:
    athlete: Athlete
    parts: dict[str, float]  # the apparatus this member competed on


@dataclass(frozen=True)
class TeamResult:
    nation: str
    rank: int
    total: float
    parts: dict[str, float]  # apparatus subtotals, in order
    members: tuple[TeamMember, ...] = ()
    verified: bool = False
    source: str = ""
    detail_source: str | None = None


@dataclass(frozen=True)
class Phase:
    round: str
    discipline: str
    apparatus: str
    results: tuple[Result | TeamResult, ...]


@dataclass(frozen=True)
class SourceResult:
    source: str
    revision: str
    phases: tuple[Phase, ...]


@dataclass(frozen=True)
class Canary:
    """One known row a Wikipedia-only competition must reproduce exactly."""

    phase: str  # "finale/MAG/FX"
    athlete: str
    total: float


@dataclass(frozen=True)
class Competition:
    slug: str
    name: str
    level: str
    tier: str
    city: str
    country: str
    start_date: str
    end_date: str
    sources: dict[str, str] = field(default_factory=dict)
    canary: Canary | None = None
    medals: tuple[str, ...] = ()  # rounds whose phases award medals (#198: not inferred)
    phases: tuple[Phase, ...] = ()
