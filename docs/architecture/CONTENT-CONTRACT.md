# Content Contract — Sheet, Pipeline, Generated Content

**Status:** Accepted
**Date:** 2026-08-27
**Owner:** Guido (lead developer)
**Related:** [ADR-0018](adr/0018-drive-cms-static-site.md), `docs/DECISIONS.md` ("Architecture pivot", "Publish trigger"), `src/frontend/lib/content.ts`, `src/pipeline/domain/content/`

## Purpose

This is the interface between the two Phase C work streams — the Drive/Sheets
pipeline (Stream 1, owns `src/pipeline/**`) and the Sheet/Apps Script layer
(Stream 2, owns `tools/apps-script/**`). Neither stream may change it
unilaterally once both are underway; if it turns out to be wrong, stop and
escalate rather than diverging silently — that is the one failure mode that
wastes both streams' work.

Everything here is derived from, and must stay consistent with, code that
already exists: `src/frontend/lib/content.ts` (the frontend's content loader —
authoritative for the generated content shape), `src/pipeline/domain/content/`
(the domain value objects/entities — authoritative for validation), and
`docs/product/PRD.md` (the SEO field-length requirement). Where no code exists
yet (the Sheet, Apps Script, the pipeline's own data files), this document is
what Stream 1 and Stream 2 build to.

## 1. The Google Sheet

One row per article.

| Column | Meaning | Format | Required |
|---|---|---|---|
| `titolo` | Article title | Free text | Yes |
| `doc` | Link to the Google Doc | Full Docs share URL or bare Doc ID | Yes |
| `categoria` | Category | One of: `Interviste`, `Analisi`, `Roundtable`, `Out of the Box` | Yes |
| `tag` | Tags | Comma-separated tag names (Italian) | No |
| `autore` | Author | Name matching an entry in `src/pipeline/data/authors.json` (§4) | Yes |
| `ospite` | Guest(s) | Comma-separated names (§4) | No |
| `spotify` | Spotify episode/show link | `https://open.spotify.com/(episode\|show\|track)/<id>` | No |
| `copertina` | Cover image | Google Drive share link or file ID | No |
| `meta_description` | SEO description | 140–155 characters (§5) | Yes |
| `data` | Publish date | `YYYY-MM-DD`, interpreted as Europe/Rome midnight (§3) | Yes |
| `stato` | Editorial status | `Bozza` / `Pronto` / `Pubblicato` | Yes |
| `esito` | Build outcome | Written by the pipeline, never by a writer (§7) | — |

`stato` semantics: `Bozza` (still being written) and `Pronto` (finished,
awaiting someone to trigger a publish) are both "not yet publishable" as far
as the pipeline is concerned — it treats them identically. Only `Pubblicato`
rows are candidates for publishing. Clicking "Pubblica" in the Sheet (Stream
2) is expected to set `stato` to `Pubblicato` *and* fire the dispatch in one
action, so a writer never has to set the dropdown and click a separate button.

There is no `slug` column — see §2 for how slugs are derived and locked.
There is no `meta_title` or `excerpt` column — see §5 for how those fields
are populated in generated content without one.

## 2. Article identity and slug locking

**The Doc is the article's stable identity, not the title.** The domain
layer (`entities.py`) already models this: `Article.slug_locked`,
`set_slug()`, and `SlugLockedError` exist specifically so a published
article's URL never changes even if its title is edited later (PRD item 23).
That machinery has nothing to hang off once there's no database holding the
flag between runs — the pipeline has to reconstruct it from what's already
committed.

Rule: the pipeline records the Doc ID (extracted from the `doc` column) as
`doc_id` in every article's generated frontmatter and its `index.json` entry.
This field is additional to, and not part of, the `ArticleMeta` interface in
`content.ts` — it's for the pipeline's own use, not the frontend's, so
writing it doesn't require touching `src/frontend/**`.

On every run, for each `Pubblicato` + eligible row:

1. Search the current `content/index.json` for an existing article with the
   same `doc_id`.
2. **Found** (this Doc has published before): reuse that article's existing
   `slug` and `id` unconditionally, even if `titolo` changed — the slug is
   locked. Everything else (title, body, tags, etc.) regenerates from the
   current Doc/Sheet state.
3. **Not found** (first publish): derive the slug via
   `Slug.from_title(titolo)`. If that slug collides with a *different*
   `doc_id`'s existing slug, reject the row (§7) — never silently overwrite
   another article.

## 3. Publish rule

A row is published when **`stato = Pubblicato` AND `data <= now`**, evaluated
at build time, in the **Europe/Rome** timezone (the audience and the writers
are both in Italy; "today" means the same thing to a writer setting `data`
as it does to the build deciding whether that date has arrived).

This rule is re-evaluated on every pipeline run, in full, against every row —
there is no partial/incremental state kept between runs beyond what's already
committed as generated content. Triggers:

- **`repository_dispatch`** (§8) — fired when a writer clicks "Pubblica".
- **Nightly cron** — catches rows where `data` has since passed (a
  future-dated post set to `Pubblicato` in advance).
- **`workflow_dispatch`** — manual run, for local/dev testing.

A row that is `Pubblicato` but whose `data` is still in the future is not an
error — see §7 for how this is surfaced to the writer instead of silence.

**Eligibility is re-evaluated for every row every run, but re-processing an
already-published row is skipped only when nothing that feeds its generated
content has changed.** The pipeline records two things alongside each
generated article: the Doc's Drive `modifiedTime`, and a hash of every
content-bearing Sheet field (`titolo`, `categoria`, `tag`, `autore`,
`ospite`, `spotify`, `copertina`, `meta_description`, `data` — not `stato` or
`esito`, which are workflow state, not content). A row is skipped — no
re-export, no re-conversion, no re-download, no Sheet write — only when
*both* the Doc's `modifiedTime` and that hash are unchanged from what's
stored, and the Sheet's `esito` already shows success. If either the Doc or
any content-bearing Sheet field has changed, the row takes the full path and
regenerates. This is what keeps a Sheet-only correction (fixing a
`meta_description`, retagging an article, swapping the cover image) landing
on the very next run, while an untouched article still costs zero Drive
exports — without this two-part key, a nightly cron would either fully
reprocess every published article forever (keying on eligibility alone) or
silently strand Sheet-only corrections until someone also touched the Doc
(keying on the Doc alone).

**Un-publishing is out of scope for v1.** Changing a previously-published
row's `stato` away from `Pubblicato`, or moving `data` into the future, does
**not** retract already-committed content on the next run. Because generated
content is committed to `main`, removing a live article is a manual
`git revert` of the commit that added it (per ADR-0018's stated rollback
mechanism), not something the pipeline automates. If this becomes a real
need, it gets its own contract change, not a silent addition.

## 4. Author and Guest registries

The Sheet schema (§1) has no columns for author/guest bio, photo, or links —
`autore` and `ospite` are name references, not full profiles. Their profile
data lives in two small, git-committed JSON files that Stream 1 owns and
reads (edited by Guido via PR — no admin UI, no database, consistent with
the rest of this architecture):

- `src/pipeline/data/authors.json`
- `src/pipeline/data/guests.json`

Shape (one entry per person), matching `ProfileDetail` in `content.ts` minus
`id` (the pipeline derives `id` as `author-<slug>` / `guest-<slug>`):

```json
[
  {
    "slug": "guido-s",
    "name": "Guido S.",
    "bio": "Fondatore di Allarounder, scrive di ginnastica artistica dal 2020.",
    "photo_url": null,
    "links": {}
  }
]
```

**`autore` is strict, `ospite` is lenient — deliberately asymmetric.** There
are three writers; an `autore` value that doesn't match the registry is
almost certainly a typo, so the pipeline rejects the row (§7). Guests are the
routine case — the first category is *Interviste* — so requiring a PR to
`guests.json` before every new interviewee's article can publish would defeat
the point of the pivot. Instead:

- If an `ospite` name matches a `guests.json` entry (case/accent-insensitive,
  same normalization as `Slug.from_title`), use that entry's bio/photo/links.
- If it doesn't match, create a minimal `Guest` from the Sheet cell alone:
  `name` as given, slug via `Slug.from_title`, `bio: null`,
  `photo_url: null`, `links: {}` — all valid per `ProfileDetail`, all
  nullable. `guests.json` is optional enrichment, not a gate.
- `autore` never does this — an unmatched author always rejects the row.

## 5. Validation (Sheet → domain value objects)

The pipeline validates every `Pubblicato` row it processes against
`src/pipeline/domain/content/` before writing any generated content. A
failing row is rejected with an Italian-language message (§7) and never
produces a broken page.

| Sheet field | Validated as | Rule |
|---|---|---|
| `titolo` | `Article.title`, source for `Slug.from_title(titolo)` on first publish (§2) | Non-empty |
| `doc` (exported body) | `Body` | Non-empty after HTML→Markdown conversion |
| `categoria` | `Category` | Must be one of the four seeded categories (§1) |
| `autore` | Author registry lookup (§4) | Must match; no inline creation |
| `spotify` | `SpotifyUrl` | Must match the Spotify URL pattern if present; empty is valid (standalone article) |
| `meta_description` | `MetaDescription` | **140–155 characters**, per `docs/product/PRD.md` item 36 |

**On the meta-description rule:** `src/pipeline/domain/content/value_objects.py`
now defines `META_DESCRIPTION_MIN_LENGTH = 140` and
`META_DESCRIPTION_MAX_LENGTH = 155`, enforced by the `MetaDescription` value
object and used by `ingest/validate.py`. This replaced the retired admin
API's storage-width cap (`META_DESCRIPTION_MAX_LENGTH = 160`, from PR #102),
which enforced neither the right range nor a minimum at all.

**Fields with no Sheet column, derived instead of authored:**

- `meta_title` → always `"{titolo} — Allarounder"`. There is no manual
  override in v1 (PRD item 37 describes a fallback; since there's no column
  to override it with, it's the fallback unconditionally).
- `excerpt` → same value as `meta_description`. The interface in `content.ts`
  keeps these as two independent fields for future flexibility, but v1's
  Sheet only has one description column, so the pipeline sets both from it.
- `og_image_url` → same value as `cover_image_url` (PRD item 39's fallback,
  unconditional for the same reason — no separate column).
- `cover_image_alt` → the article title, if a cover image is present;
  `null` otherwise. Revisit if writers ask for real alt text.
- `reading_time` → `Body.reading_time_minutes()` (words / 200, minimum 1)
  computed from the converted Markdown body, always populated.
- `publish_at` → the `data` cell, at Europe/Rome midnight, converted to UTC.
- `updated_at` → the Doc's Drive `modifiedTime` on the run that generated it.

## 6. Doc export and image handling

Export via `files.export` with `application/zip` (HTML + every embedded
image in one request) — `text/markdown` is available for text-only Docs with
no images. Convert the exported HTML to Markdown.

**Images are static assets and must live under `src/frontend/public/`, not
`src/frontend/content/`.** `content/` is read via `fs` at build time by
`lib/content.ts`; it is not copied into the exported `out/` directory as a
public asset the way `public/` is. **This corrects an earlier draft of this
plan, which described images going to `content/images/<slug>/` — that path
would not be reachable by a browser at all under `output: "export"`.**

- Cover image → `src/frontend/public/images/<slug>/cover.<ext>`,
  referenced as `/images/<slug>/cover.<ext>`.
- Inline body images (from the Doc export zip) →
  `src/frontend/public/images/<slug>/<n>.<ext>` (sequential), Markdown image
  links rewritten to `/images/<slug>/<n>.<ext>`.

`<ext>` is the source file's extension, lowercased.

## 7. `esito` write-back

The pipeline writes to the Sheet's `esito` column after a run — this is the
only writer of that column; nothing else should ever set it. A single rule
governs when: **write `esito` only when the message would change from what's
already there.** This covers every case without enumerating them: a fresh
publish, a validation failure, a newly-detected future-dated schedule, or a
previously-failing row that now succeeds all produce a new message and get
written; an already-published row that's unchanged, or an already-scheduled
row still waiting on the same date, do not — so the Sheet doesn't get
rewritten with an identical message every night.

Format, in Italian, local (Europe/Rome) time:

- Success: `✓ Pubblicato 14:32`
- Scheduled (row is `Pubblicato` but `data` is still in the future — so the
  writer who just clicked "Pubblica" sees *something*, not silence):
  `⏳ Programmato per 2026-09-01`
- Failure: `✗ <messaggio specifico>` — specific and actionable enough for a
  non-technical writer to fix without asking an engineer, e.g.:
  `✗ meta description troppo corta (128, servono 140–155)`
  `✗ categoria "Interviste " non riconosciuta — controlla spazi o refusi`
  `✗ autore "Marco" non riconosciuto — controlla il nome o chiedi a Guido di aggiungerlo`
  `✗ collegamento Spotify non valido`

## 8. `repository_dispatch` payload

Apps Script fires this when "Pubblica" is clicked. The service account it
authenticates as needs **Sheets read/write** (to fire the dispatch context
and, on the pipeline side, to write `esito` back) and **Drive read-only**
(export Docs, read images) — read-only applies to Drive specifically, not to
Sheets.

```json
{
  "event_type": "publish_request",
  "client_payload": {
    "sheet_id": "<spreadsheet ID>",
    "triggered_by": "<email of the writer who clicked Pubblica>",
    "triggered_at": "<ISO-8601 UTC timestamp>",
    "row": 14
  }
}
```

The pipeline treats `client_payload` as **advisory, not authoritative**: it
always re-evaluates the *entire* Sheet against the publish rule (§3) rather
than processing only the named row — this keeps the nightly cron and
`repository_dispatch` paths running the exact same logic. The one field it
does check is `sheet_id`, against a configured expected ID; a mismatch fails
the run immediately with a clear error in the Actions log (a defensive check
against a dispatch fired at the wrong spreadsheet), without touching
`esito` anywhere.

## 9. Generated content shape

Authoritative source: `src/frontend/lib/content.ts`. Location:
`src/frontend/content/` (not the repo root).

- `src/frontend/content/index.json` — `{ articles, categories, authors,
  guests, tags }`, matching the `ContentIndex` shape in `content.ts`.
- `src/frontend/content/articles/<slug>.md` — YAML frontmatter matching
  `ArticleMeta` (plus the pipeline-only `doc_id` and `row_hash`, §2 and §3) +
  Markdown body.
- `src/frontend/content/pages/<slug>.md` — YAML frontmatter matching
  `StaticPage` (minus `body`) + Markdown body.

`id` conventions (already in use in the sample fixtures, pin them so they
stay stable across full-Sheet regenerations): `article-<slug>`,
`page-<slug>`, `cat-<slug>`, `tag-<slug>`, `author-<slug>`, `guest-<slug>`.

Every article's frontmatter is written to **both** `index.json` (as an
`ArticleMeta` entry, no `body`) and its own `.md` file (the same fields, plus
`body`) — `content.ts` reads metadata from the former and the full article
from the latter, and the two must agree on every shared field.

## 10. Non-goals (v1)

- No excerpt or meta-title columns in the Sheet (§5 derives them).
- No un-publish / retraction flow (§3) — `git revert` only.
- No per-image alt text.
- No admin UI anywhere for editing author/guest profiles — direct JSON edits
  via PR (§4).

## Change control

This document is the interface Stream 1 and Stream 2 build to. A change here
after Phase C starts needs sign-off before either stream continues against
the old shape — don't let them silently diverge.
