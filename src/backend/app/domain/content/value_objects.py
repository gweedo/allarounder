import enum
import re
import unicodedata
from dataclasses import dataclass


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

    def __str__(self) -> str:
        return self.value
