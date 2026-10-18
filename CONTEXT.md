# Allarounder — Content/Publishing Context

The core publishing domain for Allarounder: an Italian written-articles blog that promotes a podcast hosted on Spotify. Articles are the primary content unit; the site exists to rank in Italian search and drive readers to Spotify.

## Language

**Article**:
The primary content unit. Has a title, body, slug, status, publish date, optional cover image, optional Spotify URL, one category, zero or more tags, one author, and zero or more guests.
_Avoid_: Post, entry, piece

**Body**:
The article content: authored in a Google Doc, converted to Markdown by the content pipeline, committed under `content/articles/`, and rendered to sanitized HTML at **build time** by `lib/markdown.ts`. A value object on Article.
_Avoid_: Content, text, copy

**Slug**:
The URL-safe identifier derived from the article title, used in public URLs. Derived from the title (`Slug.from_title`) the first time an article is published, then permanently locked: later runs reuse it via the article's `doc_id`, even if the title changes (`CONTENT-CONTRACT.md` §2).
_Avoid_: URL, permalink, path

**PublicationStatus**:
One of three states an article can be in: `draft` (default, not publicly visible), `published` (visible if `publish_at <= now`), `archived` (previously published, now hidden — record preserved). Writers set it through the Sheet's `stato` column (`Bozza` / `Pronto` / `Pubblicato`); the pipeline publishes only `Pubblicato` rows whose `data <= now`, checked at build time.
_Avoid_: State, visibility, status

**Author**:
The named person credited as the writer of an article. Has a public byline: name, bio, photo, and optional links. There is no login system (ADR-0018) — an Author is a byline only, not an account.
_Avoid_: Writer, contributor, user

**Guest**:
A named person who appeared on a podcast episode. Has a name, short bio, and optional photo and links. An article references zero or more guests. Not the same as a guest writer — guest writers are modeled as Authors.
_Avoid_: Interviewee, speaker, host

**Episode**:
The audio content published on Spotify. Not a modeled entity — represented on an Article only as an optional Spotify URL value object. The site hosts no audio.
_Avoid_: Podcast episode (in code), audio

**SpotifyUrl**:
A validated URL value object on Article pointing to the corresponding Spotify episode. Optional — articles may exist without one.
_Avoid_: Podcast link, episode link

**Cover image**:
An image associated with an article, taken from the Sheet's `copertina` Drive link by the content pipeline and committed as a static asset under `src/frontend/public/images/<slug>/`. Referenced on Article by path. Optional.
_Avoid_: Thumbnail, hero image, featured image

**Event**:
A community meetup, competition, or in-person gathering that Allarounder promotes. Has a title, date, location, description, optional cost, optional max capacity, and optional external registration link. Informational only in v1 — no on-site registration or seat management. In-house registration is deferred to a future version. **Not built:** decided pre-pivot (`DECISIONS.md`, "Events in v1"), but the static site has no Event content type or `/eventi/` route, and ADR-0018's v1 scope omits it.
_Avoid_: Competition (too narrow), activity

## Taxonomy

**Category**:
A broad, mutually-exclusive topic area that every article belongs to exactly one of. v1 categories: **Interviste**, **Analisi**, **Roundtable**, **Out of the Box** (sport-adjacent / off-topic pieces). Categories drive top-level navigation and filtered listing pages.
_Avoid_: Topic (use for tags), section, type

**Tag**:
A freeform keyword that describes an article's subject matter. An article can have zero or more tags. Tags support related-content discovery and SEO long-tail.
_Avoid_: Label, keyword (internally), topic (use Category for broad areas)

## Authoring

**Article template**:
The Google Doc copied for every new article by "Nuovo articolo". Holds the template notes, the cut line, and a starting structure below it.
_Avoid_: Boilerplate, skeleton, starter doc

**Template notes**:
Writer-facing guidance at the top of an article Doc, above the cut line — what formatting the site supports, with samples. Never published. Writers see it as "Promemoria".
_Avoid_: Instructions, header, preamble

**Cut line**:
The fixed marker line in an article Doc that separates the template notes from the body: only what is below it becomes the Body. A Doc without a cut line is all Body.
_Avoid_: Separator, divider, marker
