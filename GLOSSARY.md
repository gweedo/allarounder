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
_Avoid_: Competition (that word is the stats record, see Statistics), activity

## Taxonomy

**Category**:
A broad, mutually-exclusive topic area that every article belongs to exactly one of. v1 categories: **Interviste**, **Analisi**, **Roundtable**, **Out of the Box** (sport-adjacent / off-topic pieces). Categories drive top-level navigation and filtered listing pages.
_Avoid_: Topic (use for tags), section, type

**Tag**:
A freeform keyword that describes an article's subject matter. An article can have zero or more tags. Tags support related-content discovery and SEO long-tail.
_Avoid_: Label, keyword (internally), topic (use Category for broad areas)

## Statistics

**Competition**:
One gymnastics championship in the stats data (e.g. the 2026 Worlds in Rotterdam): slug, Italian name, level, tier, city, country, dates, the rounds that award medals, and its sources. Listed in `src/pipeline/stats/competitions.yaml`; one JSON file per competition. Shown as "Gara" in the UI. Stats only, not an Event.
_Avoid_: Event, meet, gara (in code)

**Phase**:
One results table of a Competition: a round (`qualifica`, `finale-aa`, `finale`) × a discipline (`MAG`, `WAG`) × an apparatus (`FX` … `BB`, `AA`, `TEAM`). Carries `medals` (from the competition's medal rounds) and `fieldComplete` (false when the source lists only qualifiers).
_Avoid_: Event (FIG's word for an apparatus), table, session

**Result**:
One row of a Phase: an athlete (or a nation, for teams) with the source's own rank and total, plus optional score detail. Its `kind` (`routine`, `vault`, `allAround`, `team`) follows from the apparatus and fixes which detail it may carry.
_Avoid_: Score (a Result has several), entry

**Source**:
Where stats numbers come from, behind one seam in `src/pipeline/stats/sources/`: **World Gymnastics** (official, primary: ranks, totals, the full field) and **Wikipedia** (backup: D/E/bonus/penalty detail). A row records its `source` and, when Wikipedia added detail to an official row, its `detailSource`.
_Avoid_: Feed, provider, scraper

**Verified row**:
A Result whose official total and rank come from World Gymnastics (`verified: true`). A Wikipedia row reaches the output only by matching an official row and adding up arithmetically, or, for a Wikipedia-only Competition, as `verified: false`, hidden on the site until an editor approves it.
_Avoid_: Checked, valid, approved (approval is the editor's step)
