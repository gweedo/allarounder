"""Author and Guest registries (CONTENT-CONTRACT.md §4).

`autore` is matched strictly against `authors.json` -- no inline creation.
`ospite` is matched leniently: a name with no registry entry still produces
a minimal Guest built from the Sheet cell alone, so a new interviewee never
needs a PR before their article can publish.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from domain.content.value_objects import Slug


@dataclass(frozen=True)
class Profile:
    slug: str
    name: str
    bio: str | None = None
    photo_url: str | None = None
    links: dict[str, str] = field(default_factory=dict)


def normalize_name(name: str) -> str:
    """Case- and accent-insensitive comparison key, matching the
    normalization `Slug.from_title` already uses."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_only = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_only).strip().lower()


def load_registry(path: Path) -> list[Profile]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [
        Profile(
            slug=entry["slug"],
            name=entry["name"],
            bio=entry.get("bio"),
            photo_url=entry.get("photo_url"),
            links=entry.get("links", {}),
        )
        for entry in raw
    ]


def match_author(name: str, registry: list[Profile]) -> Profile | None:
    """Strict lookup (CONTENT-CONTRACT.md §4): `None` if no entry matches."""
    normalized = normalize_name(name)
    for profile in registry:
        if normalize_name(profile.name) == normalized:
            return profile
    return None


def match_or_create_guest(name: str, registry: list[Profile]) -> Profile:
    """Lenient lookup (CONTENT-CONTRACT.md §4): falls back to a minimal
    profile built from the Sheet cell alone when nothing matches."""
    normalized = normalize_name(name)
    for profile in registry:
        if normalize_name(profile.name) == normalized:
            return profile
    return Profile(slug=str(Slug.from_title(name)), name=name)


def split_names(cell: str) -> list[str]:
    """Splits a comma-separated Sheet cell (`tag`, `ospite`) into trimmed,
    non-empty names."""
    return [part.strip() for part in cell.split(",") if part.strip()]
