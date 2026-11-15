"""athletes.json: the athlete identity registry (issue #193; full slug
locking is #196). A slug, once written, never changes: an athlete is matched
on the World Gymnastics id, then on the Wikipedia title, then on slug +
nation when no id contradicts it. A new slug that would collide with someone
else's rejects the competition instead of guessing a suffix (open ADR point)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from domain.content.value_objects import Slug
from domain.stats.model import Athlete


class SlugCollision(ValueError):
    """Two different athletes would share one slug."""


def _same_person(entry: dict[str, Any], athlete: Athlete) -> bool:
    """Same slug and nation, and no id that says otherwise: a WG-only record
    ("Fusuke MAEDA", wgId) and a Wikipedia-only one ("Fusuke Maeda", title)."""
    conflicting = (entry.get("wgId") is not None and athlete.wg_id is not None and entry["wgId"] != athlete.wg_id) or (
        entry.get("wiki") is not None and athlete.wiki is not None and entry["wiki"] != athlete.wiki)
    return entry["nation"] == athlete.nation and not conflicting


class AthleteRegistry:
    def __init__(self, entries: list[dict[str, Any]]) -> None:
        self._entries = copy.deepcopy(entries)

    @classmethod
    def load(cls, path: Path) -> AthleteRegistry:
        return cls(json.loads(path.read_text(encoding="utf-8")) if path.exists() else [])

    def entries(self) -> list[dict[str, Any]]:
        return sorted(copy.deepcopy(self._entries), key=lambda e: e["slug"])

    def copy(self) -> AthleteRegistry:
        return AthleteRegistry(self._entries)

    def _find(self, athlete: Athlete) -> dict[str, Any] | None:
        for key, value in (("wgId", athlete.wg_id), ("wiki", athlete.wiki)):
            if value is not None:
                found = next((e for e in self._entries if e.get(key) == value), None)
                if found:
                    return found
        return None

    def resolve(self, athlete: Athlete, discipline: str) -> str:
        """The athlete's slug, registering the athlete (or a missing id) if needed."""
        entry = self._find(athlete)
        if entry is None:
            slug = Slug.from_title(athlete.name).value
            taken = next((e for e in self._entries if e["slug"] == slug), None)
            if taken is not None and _same_person(taken, athlete):
                entry = taken
            elif taken is not None:
                raise SlugCollision(f"slug {slug!r} for {athlete.name} ({athlete.nation}) already belongs to "
                                    f"{taken['name']} ({taken['nation']})")
            else:
                entry = {"slug": slug, "name": athlete.name, "nation": athlete.nation, "discipline": discipline}
                self._entries.append(entry)
        for key, value in (("wiki", athlete.wiki), ("wgId", athlete.wg_id)):
            if value is not None and key not in entry:
                entry[key] = value
        return str(entry["slug"])
