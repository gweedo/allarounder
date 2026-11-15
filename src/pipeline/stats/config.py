"""competitions.yaml: the list of competitions a stats run builds (issue #193).

One entry per competition: slug, Italian name, level, tier, city, country,
dates, the rounds that award medals, and at least one source (World
Gymnastics event ID and/or Wikipedia page), plus an optional canary row.
"""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
from typing import Any

import yaml

from domain.content.value_objects import Slug
from domain.stats.model import Canary, Competition

SOURCES = ("wg", "wikipedia")
ROUNDS = ("qualifica", "finale-aa", "finale")
TEXT_FIELDS = ("name", "level", "tier", "city", "country")
PHASE_LABEL = re.compile(r"^(qualifica|finale-aa|finale)/(MAG|WAG)/(FX|PH|SR|VT|PB|HB|UB|BB|AA|TEAM)$")


class ConfigError(ValueError):
    """competitions.yaml is malformed; nothing is fetched or written."""


def _date(entry: dict[str, Any], key: str, where: str) -> str:
    value = entry.get(key)
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    raise ConfigError(f"{where}: {key} must be a YYYY-MM-DD date, got {value!r}")


def _canary(raw: Any, where: str) -> Canary | None:
    if raw is None:
        return None
    if not isinstance(raw, dict) or not PHASE_LABEL.match(str(raw.get("phase", ""))):
        raise ConfigError(f"{where}: canary needs phase (e.g. finale/MAG/FX), athlete and total")
    try:
        return Canary(phase=raw["phase"], athlete=str(raw["athlete"]), total=float(raw["total"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise ConfigError(f"{where}: canary needs phase, athlete and total") from exc


def _competition(entry: Any, index: int) -> Competition:
    if not isinstance(entry, dict):
        raise ConfigError(f"entry {index}: expected a mapping")
    slug = str(entry.get("slug", ""))
    where = f"entry {index} ({slug or 'no slug'})"
    try:
        Slug(slug)
    except ValueError as exc:
        raise ConfigError(f"{where}: invalid slug {slug!r}") from exc
    missing = [key for key in TEXT_FIELDS if not isinstance(entry.get(key), str) or not entry[key].strip()]
    if missing:
        raise ConfigError(f"{where}: missing {', '.join(missing)}")
    medals = entry.get("medals")
    if not isinstance(medals, list) or any(r not in ROUNDS for r in medals):
        raise ConfigError(f"{where}: medals must list the rounds that award medals, from {', '.join(ROUNDS)}")
    sources = entry.get("sources")
    if not isinstance(sources, dict) or not sources or any(k not in SOURCES for k in sources):
        raise ConfigError(f"{where}: sources needs at least one of {', '.join(SOURCES)}")
    return Competition(
        slug=slug,
        **{key: entry[key].strip() for key in TEXT_FIELDS},
        start_date=_date(entry, "start_date", where),
        end_date=_date(entry, "end_date", where),
        sources={key: str(ref) for key, ref in sources.items()},
        canary=_canary(entry.get("canary"), where),
        medals=tuple(medals),
    )


def load_competitions(path: Path) -> list[Competition]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    if not isinstance(raw, list):
        raise ConfigError(f"{path.name}: expected a list of competitions")
    competitions = [_competition(entry, i + 1) for i, entry in enumerate(raw)]
    seen: set[str] = set()
    for competition in competitions:
        if competition.slug in seen:
            raise ConfigError(f"{path.name}: duplicate slug {competition.slug!r}")
        seen.add(competition.slug)
    return competitions
