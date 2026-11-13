"""World Gymnastics source adapter (issue #193): one event's results from the
public (undocumented) JSON feed behind gymnastics.sport → SourceResult.

Totals, ranks and the full field only: the feed has no D/E breakdown.
Anything unexpected in the feed raises SourceError.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from domain.stats.model import (
    Athlete,
    Phase,
    Result,
    SourceResult,
    TeamMember,
    TeamResult,
)
from stats.http import HttpClient
from stats.sources import SourceError

BASE = "https://www.gymnastics.sport/api/sportevents/"
DISCIPLINES = {2: "MAG", 3: "WAG"}  # /api/constants/officialdisciplines/
APPARATUS = {
    "All-Around": "AA", "Floor Exercise": "FX", "Pommel Horse": "PH", "Still Rings": "SR",
    "Vault": "VT", "Parallel Bars": "PB", "Horizontal Bar": "HB", "Uneven Bars": "UB",
    "Balance Beam": "BB", "Team": "TEAM",
}
ROUNDS = (("qualifica", "rankqualif", "scorequalif"), ("finale", "rankfinal", "scorefinal"))


def _athlete(gymnast: dict[str, Any], nation: str) -> Athlete:
    return Athlete(name=f"{gymnast['firstname']} {gymnast['lastname']}", nation=nation, wg_id=gymnast["id"])


def _row(row: dict[str, Any], apparatus: str, rank_key: str, score_key: str) -> Result | TeamResult:
    nation = row["country"]
    if apparatus == "TEAM":
        members = tuple(TeamMember(athlete=_athlete(g, nation), parts={}) for g in row["gymnasts"])
        return TeamResult(nation=nation, rank=row[rank_key], total=row[score_key], parts={}, members=members)
    if len(row["gymnasts"]) != 1:
        raise SourceError(f"individual row with {len(row['gymnasts'])} gymnasts")
    return Result(athlete=_athlete(row["gymnasts"][0], nation), rank=row[rank_key], total=row[score_key])


class WorldGymnasticsSource:
    def __init__(self, http: HttpClient) -> None:
        self._http = http

    def _get(self, path: str, **params: int) -> Any:
        return self._http.get_json(BASE + path, {k: str(v) for k, v in params.items()})["data"]

    def fetch(self, ref: str) -> SourceResult:
        raw: list[Any] = []
        phases: list[Phase] = []
        for age in self._get(f"{ref}/agecategories/"):
            discipline = DISCIPLINES.get(age["iddiscipline"])
            if discipline is None or "Senior" not in age["name"]:
                continue  # artistic seniors only, for now
            for category in self._get(f"{ref}/categories/", idDiscipline=age["iddiscipline"]):
                if category["name"] not in APPARATUS:
                    raise SourceError(f"wg {ref}: unknown category {category['name']!r}")
                apparatus = APPARATUS[category["name"]]
                rows = self._get(f"{ref}/results/", ageCategory=age["id"], category=category["id"])
                raw.append(rows)
                for rnd, rank_key, score_key in ROUNDS:
                    results = tuple(sorted((_row(r, apparatus, rank_key, score_key)
                                            for r in rows if r[score_key] is not None),
                                           key=lambda r: r.rank))
                    if results:
                        name = "finale-aa" if rnd == "finale" and apparatus == "AA" else rnd
                        phases.append(Phase(round=name, discipline=discipline, apparatus=apparatus,
                                            results=results))
        revision = hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()[:12]
        return SourceResult(source="wg", revision=revision, phases=tuple(phases))
