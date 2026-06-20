import enum
import re
import unicodedata
from dataclasses import dataclass

_SPOTIFY_PATTERN = re.compile(
    r"^https://open\.spotify\.com/(episode|show|track)/[A-Za-z0-9]+$"
)


class PublicationStatus(enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


@dataclass(frozen=True)
class Slug:
    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise ValueError("Slug cannot be empty")
        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", self.value):
            raise ValueError(f"Invalid slug: {self.value!r}")

    @classmethod
    def from_title(cls, title: str) -> "Slug":
        nfkd = unicodedata.normalize("NFKD", title)
        ascii_only = nfkd.encode("ascii", "ignore").decode("ascii")
        slug = ascii_only.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = slug.strip("-")
        if not slug:
            raise ValueError(f"Cannot generate slug from title: {title!r}")
        return cls(slug)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Body:
    value: str

    def reading_time_minutes(self) -> int:
        words = len(self.value.split())
        return max(1, round(words / 200))

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class SpotifyUrl:
    value: str

    def __post_init__(self) -> None:
        if not _SPOTIFY_PATTERN.match(self.value):
            raise ValueError(f"Invalid Spotify URL: {self.value!r}")

    def __str__(self) -> str:
        return self.value
