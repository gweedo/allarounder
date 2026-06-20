import uuid
from dataclasses import dataclass, field
from datetime import datetime

from app.domain.content.exceptions import SlugLockedError
from app.domain.content.value_objects import Body, PublicationStatus, Slug


@dataclass
class StaticPage:
    id: uuid.UUID
    title: str
    slug: Slug
    body: str
    updated_at: datetime
    meta_title: str | None = field(default=None)
    meta_description: str | None = field(default=None)


@dataclass
class Author:
    id: uuid.UUID
    name: str
    slug: Slug
    created_at: datetime
    user_id: uuid.UUID | None = field(default=None)
    bio: str | None = field(default=None)
    photo_url: str | None = field(default=None)
    links: dict[str, str] = field(default_factory=dict)


@dataclass
class Guest:
    id: uuid.UUID
    name: str
    slug: Slug
    created_at: datetime
    bio: str | None = field(default=None)
    photo_url: str | None = field(default=None)
    links: dict[str, str] = field(default_factory=dict)


@dataclass
class Category:
    id: uuid.UUID
    name: str
    slug: Slug
    description: str | None = field(default=None)


@dataclass
class Tag:
    id: uuid.UUID
    name: str
    slug: Slug


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
    excerpt: str | None = field(default=None)
    cover_image_url: str | None = field(default=None)
    cover_image_alt: str | None = field(default=None)
    meta_title: str | None = field(default=None)
    meta_description: str | None = field(default=None)
    og_image_url: str | None = field(default=None)
    reading_time: int | None = field(default=None)
    preview_token: uuid.UUID | None = field(default=None)
    category_id: uuid.UUID | None = field(default=None)
    author_profile_id: uuid.UUID | None = field(default=None)
    tag_ids: list[uuid.UUID] = field(default_factory=list)
    guest_ids: list[uuid.UUID] = field(default_factory=list)

    def set_slug(self, new_slug: Slug) -> None:
        if self.slug_locked:
            raise SlugLockedError("Slug cannot be changed after publication")
        self.slug = new_slug

    def publish(self, now: datetime) -> None:
        self.status = PublicationStatus.published
        self.slug_locked = True
        self.preview_token = None
        self.updated_at = now
        if self.publish_at is None:
            self.publish_at = now

    def archive(self, now: datetime) -> None:
        self.status = PublicationStatus.archived
        self.updated_at = now
