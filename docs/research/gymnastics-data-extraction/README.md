# Gymnastics data extraction spike

> Issue [#188](https://github.com/gweedo/allarounder/issues/188), part of the stats page work (closed tracker #185). Follows the source survey in [`../gymnastics-data-sources/README.md`](../gymnastics-data-sources/README.md) (#187). Spike date **2026-11-13**. The code here is throwaway and does not belong in `src/pipeline/` as it stands.

We can turn a Wikipedia championship article into validated JSON that the build can read, in about 10 seconds and 7 polite API requests. The Wikipedia numbers match the official World Gymnastics figures. Our arithmetic checks also caught **10 rows where Wikipedia contradicts itself**:

- 4 have a wrong published total;
- 5 have the right total, but a wrong apparatus subtotal or member score;
- 1 (Italy's team vault, off by 0.033) is unconfirmed. That makes validation the core of the job. Only Wikipedia data is committed: World Gymnastics and FGI data stays out of the repo until [#191](https://github.com/gweedo/allarounder/issues/191) gets a written yes. The World Gymnastics API was exercised as a dry run only, with its output kept outside the repo.

## Files

| File | What it is |
|---|---|
| [`extract_wikipedia.py`](extract_wikipedia.py) | Fetches one en.wiki championship article, parses all final and qualification tables, validates, writes JSON in the #189 prototype's shape. Exit 0 = written, 1 = validation failed (nothing written), 2 = fetch failed |
| [`sample-worlds-2026.json`](sample-worlds-2026.json) | Output for the [2026 World Artistic Gymnastics Championships](https://en.wikipedia.org/w/index.php?title=2026_World_Artistic_Gymnastics_Championships&oldid=1385215085) (Rotterdam, MAG + WAG): 28 phases, 346 result rows, 157 athletes. **CC BY-SA 4.0, derived from Wikipedia**. See [Licence of the sample](#licence-of-the-sample) |
| [`dryrun_world_gymnastics.py`](dryrun_world_gymnastics.py) | Pulls the same event from the World Gymnastics JSON API and cross-checks the Wikipedia sample against it. Refuses to write inside the repo |

Run (repo root, pipeline venv):

```bash
src/pipeline/.venv/bin/python docs/research/gymnastics-data-extraction/extract_wikipedia.py \
  --mark-inconsistent --out docs/research/gymnastics-data-extraction/sample-worlds-2026.json
src/pipeline/.venv/bin/python docs/research/gymnastics-data-extraction/dryrun_world_gymnastics.py \
  --out "$TMPDIR/wg-17247.json" --compare docs/research/gymnastics-data-extraction/sample-worlds-2026.json
```

## Method per source

### Wikipedia (en): done, committed

- **Method.** MediaWiki Action API `action=parse&prop=text|revid` (one request), then BeautifulSoup over the rendered HTML. Then `action=query&redirects=1` in batches of 50 linked titles (6 requests, 1 s apart) to merge athletes linked under two names.
- **Why HTML, not wikitext.** The wikitext tables are built from flag, medal and athlete templates. The rendered HTML resolves all of them, and it carries everything we need as attributes:
  - medal ranks: `data-sort-value="01 !"` on the medal icon;
  - nations: the flag link `title` (`United States`), mapped to an IOC code with a hand-made table;
  - AA/team column order: the apparatus icon link titles (`Pommel horse`);
  - athlete identity: the athlete's article title;
  - qualification reserves: row background `#cccc99`.
- **What it covers.** All 14 finals (team, AA, 6 MAG + 4 WAG apparatus) with full rows. Apparatus finals include **D, E, penalty, bonus and total**, and vault finals include both vaults. It also covers all 14 qualification tables, but **only the qualifiers and reserves** (top 8–24 + R1–R3), not the full field.
- **Validation** (all in the script):
  - **Shape checks. Always fatal.** These fail the run on:
    - an unknown nation;
    - an unexpected apparatus header;
    - a non-numeric score;
    - a missing rank;
    - a phase with fewer rows than expected (8 per apparatus final, 24 per AA final, 8 teams);
    - the wrong number of phases (7 MAG finals, 5 WAG finals, 8/6 qualification tables).
  - **A canary value.** The MAG floor final winner must be Fred Richard, with D 5.700, E 8.833, bonus 0.10 and a total of 14.633. This value was cross-checked against World Gymnastics and Longines in #187.
  - **Arithmetic checks.** These check that:
    - D + E + bonus − penalty = total;
    - the vault total is the average of the two vaults, plus the bonus;
    - the AA apparatus scores add up to the AA total;
    - the team's apparatus subtotals add up to the team total;
    - each team apparatus subtotal equals the sum of the best 3 member scores.

    These failures are fatal by default. With `--mark-inconsistent` the run continues, and each bad row gets an `inconsistent: [...]` list.
- **Timing.** About 1.4 s for the parse alone, and 9–10 s including redirect resolution. Most of that is the 1 s pauses between requests.

### World Gymnastics JSON API: dry run only, not committed

- **Method.** Three endpoints from the survey, called once a second: `agecategories/`, `categories/?idDiscipline=`, and `results/?ageCategory=&category=`. That is 17 requests for one event, about 23 s. Mapping to our phases is trivial, since every row has `rankqualif/scorequalif` and `rankfinal/scorefinal`.
- **Coverage vs Wikipedia.** The API returns **1,651 rows for the same 28 phases**, against Wikipedia's 346. It covers the full qualification field: 155 men in the AA, for example. It also carries a stable gymnast ID (`gymnasts[].id`), which is exactly what our identity problem needs (see below).
- **What it lacks.** There is no D/E/bonus/penalty data, and no per-apparatus breakdown of AA or team scores. The AA breakdown endpoint returned empty again. A per-routine breakdown still requires the result-book PDF or Longines (not attempted, see below).
- **Cross-check against the Wikipedia sample.** 340 Wikipedia rows matched an official row, with these outcomes:
  - **All totals agree, except the four rows already flagged `inconsistent`.** In each of the four, the sum of Wikipedia's own scores matches the official total, and the published total doesn't. So the total is the wrong cell, and the detail is right:

    | Phase | Wikipedia's published total | Sum of Wikipedia's own scores (= official) |
    |---|---|---|
    | WAG AA qualification, Visser | 51.965 | 53.965 |
    | WAG AA qualification, Glotova | 51.865 | 53.932 |
    | WAG AA qualification, Prat | 53.032 | 53.333 |
    | WAG team qualification, Germany (apparatus subtotals) | 158.332 | 158.661 |

  - **One rank difference.** In MAG floor qualification, Doi is 8th on Wikipedia and 7th officially, on an equal score of 14.033. That is a tie-break, not a typo.
  - **Six rows did not match by name.** Korean family-name order (Yeo Seo-jeong, Hwang Seo-hyun), Grünberg, and McClenaghan. This is a limit of the throwaway name matcher, not missing data, and it is one more reason to key on IDs.
- **Status.** This is the method we would use once permission arrives: it is cheap, fast and complete for totals. It is an undocumented internal API, so expect it to change without notice.

### Not attempted in this spike

- **World Gymnastics result-book PDFs (for D/E).** These are 300+ page PDFs whose columns interleave when the text is extracted (#187 §2). Reading them reliably means layout-aware parsing (`pdfplumber` word boxes per page template). **Estimate: 3–5 days**, fragile across result-book templates. It only matters if we want D/E for events Wikipedia doesn't cover. Blocked on #191 either way.
- **Longines HTML (for D/E).** This is clean HTML with D/E/bonus/penalty columns. But it is "All rights reserved", and `curl` timed out from this devcontainer in #187. Not attempted.
- **FGI PDFs (Italian domestic).** Blocked on #191. These are per-apparatus totals only, and the folder paths change every year. A realistic flow is for editors to paste the PDF link into the Sheet, and the pipeline parses that one file. **Estimate: 2–3 days**, with ongoing fixes for each new PDF template.

## What broke, and source quirks

1. **Wikipedia has arithmetic errors.** There are 10 flagged rows in one well-maintained article:

   | Row | What's wrong | How we know |
   |---|---|---|
   | WAG AA qualification: Visser, Glotova, Prat | Published total | The sum of the scores = the official total |
   | WAG team qualification: Germany | Published total | The sum of the subtotals = the official total |
   | MAG team final: China | All six apparatus subtotals | The members' scores add up to the published total, which matches the official one |
   | MAG team qualification: USA (PB) | Subtotal `50.065` | It should read 40.065, which is the members' best 3 |
   | MAG team qualification: Belgium (HB) | Subtotal off by exactly 1.000 | Members' best 3 |
   | WAG team qualification: Netherlands (FX) | Visser's floor score: 11.9 in the team table, 13.233 in the AA table | 13.233 + 11.9 + 11.8 = 36.933, the published subtotal |
   | MAG AA final: Hashimoto | One apparatus score (unknown which). The scores add up to 86.198, while the total, 85.998, matches the official figure | The official feed has no AA breakdown, so the bad cell can't be pinned down |
   | WAG team qualification: Italy (VT) | Off by 0.033 | **Unconfirmed.** The three Italian AA totals the official data can check match exactly. Iorio's vault (13.433) can't be checked; it may be the bad cell, or the subtotal may be |

   **Every case the official data could check was a real error in Wikipedia, not in our checks.**
2. **Ties use `rowspan` on every cell, not only the rank.** The first parser dropped tied rows; the fix was a full rowspan-expanding grid. Team tables span the rank and total cells over six member rows.
3. **Layout differs by table, not only by article.**
   - The men's vault has a bonus per vault; the women's vault has one Bonus column.
   - Team rows have an unlinked flag followed by a country link, while athlete rows have a linked flag.
   - Penalties are written as `-0.1` or `0.1`.
   - One cell reads `50.065 16)` (missing parenthesis), and one reads `52,698` (decimal comma).
4. **Athlete identity.** The same athlete appears under different link titles: "Frederick Richard" redirects to "Fred Richard", which redirect resolution fixed. Two other problems remain: a misspelling with no link (Amine/Armine Abaidi), and 22 athletes without an article. Slugs from display names will collide and drift across events. **Production needs a stable athlete ID.** The World Gymnastics gymnast ID is the natural key, reachable from Wikipedia via Wikidata P2696/P7440 (#187 §9).
5. **Wikipedia qualification tables are partial** (qualifiers and reserves only). A "season best" leaderboard built from Wikipedia alone would be missing most athletes' qualification scores.
6. **The nation table is hand-made**, and an unknown country fails the run ("Republic of Ireland" did, on the first run). For events with neutral athletes (WG1/WG2, AIN), Wikipedia shows the country flag, and our table maps that to the country's IOC code (RUS, BLR). See the open points.
7. **Network.** Wikipedia and the World Gymnastics API both answered reliably from this devcontainer. Longines and FGI did not in #187.

## Proposed JSON shape

The sample follows the prototype contract (`src/frontend/app/statistiche/_prototype/data.ts` on the unmerged branch `prototype-stats-page`): `{ season, updatedAt, athletes[], competitions[{…, phases[{round, discipline, apparatus, results[]}]}] }`, with `Result.{athlete, rank, total, d, e, bonus, penalty, vaults[], parts}`. Real data needs these changes:

```ts
interface StatsFile {
  source: {               // NEW: required, for attribution and reproducibility
    name: string; title: string; url: string;  // url pins the revision (oldid)
    revid: number; license: string; licenseUrl: string;
    attribution: string;  // Italian credit line to render on the page
    retrievedAt: string;
  };
  season: number; updatedAt: string;
  athletes: Athlete[]; competitions: Competition[];
}
interface Athlete {
  slug: string; name: string; nation: string; discipline: "MAG" | "WAG";
  wiki?: string;          // NEW: Wikipedia article title (identity hint)
  birthYear?: number;     // CHANGED: optional (no source gives it; personal data, #187)
  club?: string;
}
type Apparatus = "FX" | "PH" | "SR" | "VT" | "PB" | "HB" | "UB" | "BB" | "AA" | "TEAM"; // + TEAM
interface Result {        // unchanged fields, plus:
  qualified?: string;     // "Q", "R1".."R3", "" (qualification only)
  reserve?: true;
  inconsistent?: string[];// source contradicts itself; the page should not show these rows
}
interface TeamResult {    // NEW: results of a TEAM phase
  nation: string; rank: number; total: number;
  parts: Partial<Record<Apparatus, number>>;
  members: { athlete: string; parts: Partial<Record<Apparatus, number>> }[];
  qualified?: string; inconsistent?: string[];
}
```

The rest of the prototype contract held up: `round` (`qualifica` / `finale-aa` / `finale`), per-apparatus `d/e/bonus/penalty/total`, `vaults[]` with a result-level `bonus` for women, and AA `parts`. As in the prototype, medals, leaderboards and counters stay derived at build time, never stored. Competition metadata (name, city, dates, tier) is hard-coded in the spike. In production it should come from the editorial Sheet (one row per competition) rather than be scraped.

## How the extraction should run (recommendation)

- **Trigger.** A `stats.yml` workflow with `workflow_dispatch` (an editor or Guido runs it after a competition). The Sheet's "Pubblica" button could also send a second `repository_dispatch` type. There is no nightly cron: results don't change after the event, so a cron would only re-fetch the same numbers and add noise.
- **Input.** A competitions list (Sheet tab or a file in the repo): slug, Italian name, dates, tier, source page/ID, and the source revid it was checked against.
- **Output.** `src/frontend/content/stats/<competition-slug>.json`, committed. `lib/content.ts` (or a sibling `lib/stats.ts`) reads it at build time, like `content/index.json`.
- **Commit path.** The same as `publish.yml`: a `content/stats-<run_id>` branch, a PR, then `gh pr merge --auto --squash` once CI passes. Never push to `main`. The PR diff is the review step: a changed number shows up in the diff before it goes live.
- **Failure behaviour.**
  - **Shape errors, a failed canary, or a fetch failure exit non-zero, and nothing is written.** The job fails visibly and the site keeps the last good JSON, because the committed file is the fallback. Never publish an empty or partial file.
  - **Arithmetic inconsistencies** should also fail by default. The fix is either to correct the Wikipedia article (good citizenship, and the next run picks up the fix) or to add an explicit override entry for that row in the competitions list, which records who decided and why. `--mark-inconsistent` is for the spike sample only.
  - **Pinning.** Every file records the `revid` it came from, so a re-run against a vandalised revision shows up as a diff.
- **Cost.** €0 (GitHub Actions minutes: about 1 minute per run).
- **Politeness.** Use serial requests, 1 s apart, with `maxlag=5` and `Retry-After` honoured. Wikimedia policy wants a **descriptive User-Agent with a contact address**. The spike deliberately used a generic name. Guido should choose the production UA (a project URL or a dedicated mailbox, not a personal email).

## Effort estimate

| Piece | Estimate | Notes |
|---|---|---|
| Wikipedia extractor, one article layout | done (≈0.5 day) | This spike |
| Generalise to other events (Euros, Olympics, World Cups) | 1–2 days | Each article's tables are edited by different people. Expect per-layout fixes. The validator turns drift into a failed run, not bad data |
| Production pipeline (`src/pipeline/stats/`, tests, workflow, `lib/stats.ts`) | 2–3 days | TDD per ADR-0009, reusing `publish.yml`'s PR flow |
| Wikidata ID crosswalk (World Gymnastics ID ↔ Wikipedia) | 1 day | WDQS rate limits (#187) mean the results must be cached in the repo |
| World Gymnastics JSON (totals, full fields) | 0.5–1 day | Needs permission (#191) |
| D/E from result-book PDFs | 3–5 days | Needs permission. Fragile |
| FGI PDFs (Italian domestic) | 2–3 days + upkeep | Needs permission. Template changes yearly |

## Open points for the ADR

1. **Source choice.**
   - **If #191 gets a yes:** World Gymnastics JSON for totals and the full field, plus Wikipedia for D/E in finals, joined by athlete ID.
   - **If #191 gets no answer or a no:** Wikipedia only. That means finals plus qualifiers, and the "season best" view goes away.
2. **Identity.** Key athletes on the World Gymnastics gymnast ID, via Wikidata P2696/P7440 when using Wikipedia. Slugs stay as the URL form but are locked once published, like article slugs (CONTENT-CONTRACT). Decide how a slug collision is resolved.
3. **Inconsistent rows.** Decide between failing the run, hiding those rows, or using an override file. Who reviews?
4. **CC BY-SA obligations on the page.** We need an attribution line and a link to the revision. Share-alike covers the stats JSON and tables derived from Wikipedia: does that also cover the page around them? (Probably not, but the ADR should state it.)
5. **Neutral athletes.** How to show "World Gymnastics 1/2" (BLR/RUS) athletes: under the country code as World Gymnastics does, or as neutral athletes.
6. **Disciplines and levels.** Artistic only for v1? Rhythmic and trampoline are in World Gymnastics, but were not tested here. These are the open questions for the creative team in #185.
7. **Where competition metadata lives.** Sheet tab vs a repo file.
8. **The production User-Agent and contact address** for Wikimedia, chosen by Guido.

## Licence of the sample

`sample-worlds-2026.json` is derived from the English Wikipedia article [*2026 World Artistic Gymnastics Championships*](https://en.wikipedia.org/w/index.php?title=2026_World_Artistic_Gymnastics_Championships&oldid=1385215085) (revision 1385215085), by Wikipedia contributors, and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It was reformatted to JSON, validated, and rows that don't add up were flagged. The file's `source` block carries the same attribution. It contains no World Gymnastics, FGI or Longines data.
