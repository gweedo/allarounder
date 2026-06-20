import uuid
from dataclasses import dataclass, field
from datetime import datetime

from app.domain.content.exceptions import SlugLockedError
from app.domain.content.value_objects import Body, PublicationStatus, Slug


@dataclass
class Article:
    id: uuid.UUID
    title: str
    slug: Slug
    body: Body
    status: PublicationStatus
    author_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    publish_at: datetime | None = field(default=None)
    slug_locked: bool = field(default=False)
    spotify_url: str | None = field(default=None)

    def set_slug(self, new_slug: Slug) -> None:
        if self.slug_locked:
            raise SlugLockedError("Slug cannot be changed after publication")
        self.slug = new_slug

    def publish(self, now: datetime) -> None:
        self.status = PublicationStatus.published
        self.slug_locked = True
        self.updated_at = now
        if self.publish_at is None:
            self.publish_at = now

    def archive(self, now: datetime) -> None:
        self.status = PublicationStatus.archived
        self.updated_at = now
