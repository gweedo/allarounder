# Allarounder — Content/Publishing Context

The core publishing domain for Allarounder: an Italian written-articles blog that promotes a podcast hosted on Spotify. Articles are the primary content unit; the site exists to rank in Italian search and drive readers to Spotify.

## Language

**Article**:
The primary content unit. Has a title, body, slug, status, publish date, optional cover image, optional Spotify URL, one category, zero or more tags, one author, and zero or more guests.
_Avoid_: Post, entry, piece

**Body**:
The article content, stored as Markdown plain text and rendered to HTML at view time. A value object on Article.
_Avoid_: Content, text, copy

**Slug**:
The URL-safe identifier derived from the article title, used in public URLs. Auto-generated from the title on create, editable until first publish, permanently locked once the article is published.
_Avoid_: URL, permalink, path

**PublicationStatus**:
One of three states an article can be in: `draft` (default, not publicly visible), `published` (visible if `publish_at <= now`), `archived` (previously published, now hidden — record preserved).
_Avoid_: State, visibility, status

**Author**:
The named person credited as the writer of an article. Has a public byline: name, bio, photo, and optional links. Optionally linked to a User account (nullable). An Author can exist without a User — for guest or external bylines.
_Avoid_: Writer, contributor, user (when referring to the byline)

**User**:
A login account with an email, hashed password, and role. Distinct from Author. Roles: `admin` or `editor`.
_Avoid_: Account, profile (use Author for the public profile)

**Admin**:
A User role with full access: can manage all articles, users, authors, categories, and tags.
_Avoid_: Superuser, owner

**Editor**:
A User role that can create, edit, and publish their own articles. Cannot manage users, authors, categories, or tags.
_Avoid_: Writer (too broad), contributor

**Guest**:
A named person who appeared on a podcast episode. Has a name, short bio, and optional photo and links. An article references zero or more guests. Not the same as a guest writer — guest writers are modeled as Authors with no User account.
_Avoid_: Interviewee, speaker, host

**Episode**:
The audio content published on Spotify. Not a modeled entity — represented on an Article only as an optional Spotify URL value object. The site hosts no audio.
_Avoid_: Podcast episode (in code), audio

**SpotifyUrl**:
A validated URL value object on Article pointing to the corresponding Spotify episode. Optional — articles may exist without one.
_Avoid_: Podcast link, episode link

**Cover image**:
An image associated with an article, uploaded directly to Azure Blob Storage via a short-lived SAS token. Stored on Article as a Blob URL. Optional.
_Avoid_: Thumbnail, hero image, featured image

**Preview**:
A draft article rendered in the public layout, accessible via a secret token URL. Allows writers to inspect how an article will look before publishing.
_Avoid_: Draft view, staging view

**Event**:
A community meetup, competition, or in-person gathering that Allarounder promotes. Has a title, date, location, description, optional cost, optional max capacity, and optional external registration link. Informational only in v1 — no on-site registration or seat management. In-house registration is deferred to a future version.
_Avoid_: Competition (too narrow), activity

## Taxonomy

**Category**:
A broad, mutually-exclusive topic area that every article belongs to exactly one of. v1 categories: **Interviste**, **Analisi**, **Roundtable**, **Out of the Box** (sport-adjacent / off-topic pieces). Categories drive top-level navigation and filtered listing pages.
_Avoid_: Topic (use for tags), section, type

**Tag**:
A freeform keyword that describes an article's subject matter. An article can have zero or more tags. Tags support related-content discovery and SEO long-tail.
_Avoid_: Label, keyword (internally), topic (use Category for broad areas)
