# Apps Script — Allarounder editorial Sheet

Source for the "Pubblica" / "Nuovo articolo" menu and column data validation
on the editorial Google Sheet. See
[`docs/architecture/CONTENT-CONTRACT.md`](../../docs/architecture/CONTENT-CONTRACT.md)
for the Sheet schema and the `repository_dispatch` payload this fires, and
[`docs/product/editorial-workflow.md`](../../docs/product/editorial-workflow.md)
for the writer-facing guide.

## What's here

| File | Purpose |
|---|---|
| `src/Menu.js` | `onOpen()` — adds the "Allarounder" custom menu |
| `src/Publish.js` | "Pubblica": sets `stato` to `Pubblicato`, fires `repository_dispatch` |
| `src/NewArticle.js` | "Nuovo articolo": creates a Doc and a draft row |
| `src/Validation.js` | "Configura validazione colonne": installs the `categoria`/`stato`/`autore` dropdowns |
| `src/Columns.js` | Column order, category/status/author lists, column-index lookup |
| `src/Payload.js` | Builds the `repository_dispatch` JSON body |
| `src/appsscript.json` | Apps Script project manifest |
| `test/` | Jest tests for the pure logic (`Columns.js`, `Payload.js`, `buildNewArticleRow`) |

Files that call `SpreadsheetApp`, `DocumentApp`, `UrlFetchApp`, or
`PropertiesService` directly (`Publish.js`'s `handlePubblica`/
`triggerRepositoryDispatch`, `NewArticle.js`'s `handleNuovoArticolo`/
`createArticleDoc`, all of `Validation.js`, `Menu.js`) are **not** unit
tested — they only run inside the Apps Script runtime, which nothing in this
repo can emulate. **This has not been verified against a live Sheet**, because
no Sheet, Apps Script project, or GitHub PAT exists yet. Run `npm test` for
what is covered; everything else needs manual end-to-end verification once
the Sheet is created (see below).

## Setup (once the Sheet exists)

Nothing here is live yet — this is source code to deploy once the editorial
Sheet is created. Someone with access to Google Workspace and the
`gweedo/allarounder` repo needs to:

1. **Create the Sheet**, columns matching `CONTENT-CONTRACT.md` §1 in this
   exact order: `titolo, doc, categoria, tag, autore, ospite, spotify,
   copertina, meta_description, data, stato, esito`. `src/Columns.js`'s
   `COLUMN_ORDER` must match this order exactly, or every dropdown and the
   "Pubblica" action will write to the wrong column.
2. **Bind an Apps Script project to it**: Extensions → Apps Script, from
   the Sheet itself (this makes it container-bound, so `SpreadsheetApp`
   calls resolve to the right Sheet with no ID to configure).
3. Either:
   - **With [clasp](https://github.com/google/clasp)** (`npm install -g
     @google/clasp && clasp login`): `clasp clone <scriptId>` (the ID from
     the Apps Script project's Project Settings) into this directory, or
     copy `.clasp.json.example` to `.clasp.json` and fill in the real
     `scriptId` — **never commit `.clasp.json`**, it's gitignored. Then
     `clasp push` from this directory to upload `src/*.js` and
     `src/appsscript.json`.
   - **Without clasp**: open the Apps Script editor, create one script file
     per file under `src/` (matching filenames, drop the `.js` — Apps
     Script adds its own extension), paste each file's contents in, and
     paste `src/appsscript.json`'s content into the editor's manifest view
     (Project Settings → "Show appsscript.json").
4. **Set script properties** (Project Settings → Script Properties, in the
   Apps Script editor): `GITHUB_TOKEN` (a PAT — fine-grained, scoped to
   `gweedo/allarounder` contents: read, so it can fire `repository_dispatch`;
   never commit this), `GITHUB_OWNER` (`gweedo`), `GITHUB_REPO`
   (`allarounder`).
5. **Reload the Sheet.** The "Allarounder" menu should appear (`onOpen`).
   Run "Configura validazione colonne" once to install the `categoria`,
   `stato`, and `autore` dropdowns.
6. **Article template Doc**: `NewArticle.js`'s `createArticleDoc()` currently
   builds a bare Doc with a minimal outline from scratch, because no real
   house-style template exists yet. Once one is produced, set a
   `TEMPLATE_DOC_ID` script property and swap in the `DriveApp.getFileById(...).makeCopy()`
   approach described in the `TODO` comment in that file.

## Keeping the `autore` dropdown in sync

`src/Columns.js`'s `AUTORI` list is a hand-maintained copy of
`src/pipeline/data/authors.json` (owned by the pipeline). Per
`CONTENT-CONTRACT.md` §4, `autore` is validated strictly — an unmatched name
rejects the whole row — so if `authors.json` gains a new author, `AUTORI`
here needs the same addition (and a `clasp push` / manual re-paste) or the
pipeline will reject a row the Sheet's own dropdown allowed. There is no
automation linking the two files in v1; both are small, PR-reviewed, and
rarely change.

`ospite` has no dropdown — `CONTENT-CONTRACT.md` §4 makes guest matching
lenient by design (an unknown name creates a minimal guest profile rather
than rejecting the row), so free text is correct there.
