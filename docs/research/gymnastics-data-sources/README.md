# Gymnastics data sources for the stats page

> Issue [#187](https://github.com/gweedo/allarounder/issues/187), part of [#185](https://github.com/gweedo/allarounder/issues/185). Research date **2026-11-10**. Each claim was checked against the source itself: its pages, its `robots.txt`, its JSON responses, or a sample PDF downloaded and read. Claims that come only from search-engine snippets, or that could not be reached from this environment, are marked **unverified**. No extraction code was written; that is #188. This is not legal advice. The licence positions below say what each source publishes, not what a court would decide.

The best data is official, and it is also the least clearly licensed. **World Gymnastics** (the FIG, which rebranded on 9 December 2025, [Inside Gymnastics](https://www.insidegymnastics.com/news-features/international-gymnastics-federation-fig-unveils-new-global-identity-world-gymnastics/)) runs an undocumented but public JSON API behind its results page. The API returns every sanctioned event with per-apparatus totals and ranks, back to 2009, across every discipline. The full D/E/bonus/penalty breakdown is in the official result-book PDFs and on the Longines/Swiss Timing HTML results pages. Neither World Gymnastics nor Swiss Timing publishes terms that permit reuse. Swiss Timing's footer says "All rights reserved". The only openly licensed sources are **Wikipedia** (CC BY-SA 4.0) and **Wikidata** (CC0). Wikipedia carries good D/E tables for finals at major events. Wikidata is too sparse to use for scores. For **Italian domestic competitions** (Serie A, Assoluti), no source is machine-readable and none has D/E scores. The Federation (FGI) publishes PDFs with per-apparatus totals only.

## Summary table

Legend: ✅ good · ⚠️ partial or conditional · ❌ no / not usable.

| Source | Coverage | Completeness | Freshness | Format | Access | Licence / ToS | robots.txt | Stability | Cost |
|---|---|---|---|---|---|---|---|---|---|
| **World Gymnastics (FIG) API** | ✅ All 8 disciplines, all FIG-sanctioned events incl. OG, Worlds, World Cups, continental. Back to 2009 Worlds. Italian events only if FIG-sanctioned | ⚠️ Total + rank per apparatus and phase. No D/E | ✅ ≤2 days (TRA Worlds 4–8 Nov, digital by 10 Nov) | JSON (undocumented) | ✅ Public, no key | ⚠️ No terms found. Permission needed | ✅ Allow all | ⚠️ Internal frontend API | €0 |
| **World Gymnastics result books** | ✅ Same events. 88 of 89 artistic events in 2025–26 have one | ✅ D, E, bonus, penalty per routine | ✅ Same as above | PDF (300+ pages) | ✅ Public | ⚠️ No terms found. Permission needed | ✅ Allow all | ✅ Stable ID scheme | €0 |
| **Longines / Swiss Timing** (`gym.longinestiming.com`) | ⚠️ FIG top-tier events only (Worlds, World Cups, etc.), 2001–2026. No ITA domestic | ✅ Dif/Exe/Bon/Pen/Total per routine | ✅ Live during competition | HTML (+ PDFs) | ✅ Public | ❌ "© Swiss Timing Ltd., All rights reserved". No ToS found | ✅ No robots.txt (404) | ⚠️ Opaque phase IDs | €0 |
| **European Gymnastics (UEG)** | ⚠️ European Championships only (all disciplines) | ✅ PDFs per phase (D/E not checked in sample) | ✅ "Published after each competition" | PDF | ✅ Public | ❌ "© All rights reserved". No ToS found | ⚠️ Front-end has none. Backend Drupal default | ⚠️ Moved `backend` → `new-backend` host | €0 |
| **SmartScoring** (UEG live) | ⚠️ UEG events | Unverified | Live | SPA (no API confirmed) | Public | Unverified | ❌ No robots.txt (SPA shell) | Unverified | €0 |
| **Olympics.com / IOC** | ⚠️ Olympic Games only | Unverified | Unverified | HTML | ❌ Unreachable from here | ❌ Written authorisation required (snippet) | Unverified | — | €0 |
| **FGI (federginnastica.it)** | ⚠️ ✅ Italian Serie A, Assoluti, national events | ⚠️ Per-apparatus totals. No D/E | ⚠️ No 2026 PDFs found | PDF | ⚠️ Public, but site flaky (503, expired cert on apex) | ⚠️ No terms found. Permission needed | ✅ Joomla default. `/images/` allowed | ❌ Paths change every year | €0 |
| **Wikipedia (en/it)** | ⚠️ Major events (en). it.wiki: Assoluti articles 2010–2023 | ✅ Finals with D/E/Pen/Bon (en). Qualification totals | ⚠️ Volunteer. 2026 Worlds already complete | Wikitext/HTML via API | ✅ Public API | ✅ CC BY-SA 4.0 (attribution + share-alike) | ✅ API allowed | ⚠️ Table layout varies by editor | €0 |
| **Wikidata** | ⚠️ Athlete IDs (FIG licence/bio, Olympedia), events | ❌ No scores. Rank on 1–18 participants per Paris 2024 event | Volunteer | SPARQL / JSON | ⚠️ Public. Rate limits (429 today) | ✅ CC0 | `/sparql` disallowed for crawlers. API use governed by WDQS policy | ✅ Stable | €0 |
| **Olympedia** | ⚠️ Olympic Games only, all disciplines | ✅ D/E/Pen (and Artistry for RG) | Unverified (Paris 2024 present) | HTML | ✅ Public | ❌ "© OlyMADMen". No reuse terms | ⚠️ `Crawl-delay: 10` | ✅ Stable | €0 |
| **UCSAS `gym2024data`** (GitHub) | ⚠️ MAG/WAG 2017–2023, 40 elite events, 24,434 rows (2022–23) | ✅ D/E/Penalty/Score per routine | ❌ Frozen 2023-11-29 | CSV | ✅ Public | ❌ No licence (`license: null`). Scraped from official PDFs | n/a | ✅ (frozen) | €0 |
| **The Gymternet** | ✅ MAG/WAG worldwide incl. Italian Serie A and Jesolo | ⚠️ Per-apparatus totals. No D/E in sample | ✅ Next day (Serie A Final) | HTML (WordPress) | ✅ Public | ❌ Author keeps ownership (WordPress.com ToS) | ✅ Content allowed | ✅ | €0 |
| **gymnasticsresults.com** | ⚠️ MAG/WAG elite, 2000–2026 | ⚠️ Medallists + rehosted PDFs | ✅ 2026 Worlds present | HTML + PDF | ✅ Public | ❌ Content-Signal reservation (EU DSM art. 4) | ❌ ClaudeBot etc. disallowed | ⚠️ "Transitioning" | €0 |
| **Kaggle / TidyTuesday "120 years"** | ⚠️ Olympics 1896–2016, medals only | ❌ Medals only | ❌ Frozen 2018 | CSV | ✅ Public | ❌ Scraped from Sports-Reference. The CC0 label doesn't clear provenance | n/a | ✅ (frozen) | €0 |

## Per-source detail

### 1. World Gymnastics (FIG): results JSON API — `gymnastics.sport`

- **What it is.** The results search page ([searchresults.php](https://www.gymnastics.sport/site/events/searchresults.php)) is a Vue 2 app. Its inline script calls same-origin JSON endpoints (`MainConfig.context = ''`). These are the ones observed and called once each for this survey:
  - `GET /api/sporteventswithresult/?from=YYYY-MM-DD&to=YYYY-MM-DD[&discipline=&level=&country=]` returns the event list (`id`, `title`, dates, city/country, discipline codes, `resultbook` asset id, `digitalresult` flag).
  - `GET /api/sportevents/{idEvent}/` returns event detail. The response also contains organiser contact fields, which we should **not** store.
  - `GET /api/sportevents/{idEvent}/agecategories/` and `/api/sportevents/{idEvent}/categories/?idDiscipline=N` return the age group and apparatus lists (MAG: AA, FX, PH, SR, VT, PB, HB, Team; WAG: AA, VT, UB, BB, FX, Team).
  - `GET /api/sportevents/{idEvent}/results/?ageCategory=&category=` returns one row per athlete: `country`, `gymnasts[{id, firstname, lastname}]`, `rankqualif/scorequalif`, `ranksemifinal/scoresemifinal`, `rankfinal/scorefinal`, `isallarond`.
  - `GET /api/sportevents/results/allaround/{id}/final|qualif/` should give the AA apparatus breakdown. It returned `{"data":[]}` for the one ID tested (438135).
  - `GET /api/constants/officialdisciplines/`, `/api/sportevents/levels/`, `/api/constants/countries/` return lookups. The levels include OG, YOG, WCh, WCup, World Challenge Cup, continental championships, Mediterranean Games, and others.
  - Constants are in the page script: [searchresults.php](https://www.gymnastics.sport/site/events/searchresults.php) and [results.php?idEvent=17247](https://www.gymnastics.sport/site/events/results.php?idEvent=17247).
- **Coverage.** Disciplines GFA, MAG, WAG, RG, TRA, ACRO, AER, Parkour (`/api/constants/officialdisciplines/`).
  - 1 Jan 2025 – 10 Nov 2026: 297 events with results. 89 are MAG/WAG, of which 48 have `digitalresult: true` and 88 have a result-book PDF.
  - Depth: the 2009 and 2010 Worlds are there as digital results. 29 of 30 artistic events in 2015–16 are digital. Paris 2024 (MAG, WAG, RG, TRA) is digital. Rio 2016 did not appear in the 2015–16 window.
  - Italian-hosted events appear only when FIG-sanctioned: the Mediterranean Games 2026 (MAG, WAG, RG, digital), Trofeo Città di Jesolo 2025/2026 (WAG, PDF only), RG and TRA World Cups, and the Pesaro Acro Worlds. **No Serie A, no Assoluti.**
- **Completeness.** Total and rank per apparatus per phase (qualification, semifinal, final), plus team and AA. **No D/E/penalty in the JSON.** Several 2026 events have `digitalresult: false` and so only a PDF: the **Senior and Junior European Championships (MAG and WAG)**, the Commonwealth Games, and the Senior Pan Ams.
- **Freshness.** The TRA Worlds ran 4–8 Nov 2026 and were `digitalresult: true` by 10 Nov. The latest event seen is the Guimagym Cup (6–8 Nov 2026).
- **Cross-check.** The 2026 Worlds MAG FX final in this API (Richard 14.633, Jarman 14.600) matches Longines and English Wikipedia exactly.
- **Access.** Public, no key, no login. No rate limit was observed; we made under 15 requests in total.
- **Licence / ToS.** No terms of use page found. The only legal page is the [Privacy Notice](https://www.gymnastics.sport/site/pages/privacy.php) (v1.1, Oct 2024), which says nothing on reuse. FIG's licence rules say that competition data is "published via the official FIG means" (seen via search snippet of [Licence Rules 2023](https://www.gymnastics-history.com/wp-content/uploads/2026/01/en_1.5-Licence-Rules-Edition-2023.pdf), **unverified**). No grant to third parties was found. **Status: permission needed.**
- **robots.txt.** `https://www.gymnastics.sport/robots.txt` redirects to `/site/robots.txt`, which contains `User-agent:* / Disallow:` (allow all). The `live.gymnastics.sport/robots.txt` file returned HTTP 500.
- **Stability.** Low to medium. The API is undocumented and internal to the frontend (Vue 2.4, jQuery 2.2). The FIG → World Gymnastics rebrand already happened, and `www.worldgymnastics.sport` now 301-redirects to `www.gymnastics.sport/site/`. A domain move is plausible.
- **Data quirk.** At the 2026 Worlds, Russia competed as "World Gymnastics 2", but World Gymnastics attributes the results to RUS ([en.wikipedia footnote citing FIG](https://en.wikipedia.org/wiki/2026_World_Artistic_Gymnastics_Championships)).
- **Cost.** €0.

### 2. World Gymnastics result books (PDF)

- **What it is.** `https://www.gymnastics.sport/asset.php?id=fidb_{resultbook}`. The asset id comes from the API's `resultbook` field. For the 2026 Worlds, `fidb_24169` is `WCHP_Rotterdam_2026_ResultBook_Media2.pdf`: 329 pages, PDF 1.7, 6.2 MB, headed "Provided by … Official Results Provider" (Longines).
- **Completeness.** Full. The MAG qualification pages list D, E, bonus and penalty per apparatus, with apparatus rank. Sample row: "MACCHIATI Mario 77.965 ITA" with FX 13.200 = D 4.700 + E 8.500. Text extraction works with `pypdf`, but the layout interleaves columns. Parsing this is #188's problem.
- **Coverage / freshness / access / licence / robots.** Same as §1. The result book is the only score source for 2026 events that have `digitalresult: false` (for example the Europeans).
- **Stability.** Good. The asset IDs are stable integers.

### 3. Longines Timing / Swiss Timing: `gym.longinestiming.com`

- **What it is.** Swiss Timing's gymnastics results portal ([home](https://gym.longinestiming.com/)). It has year lists from 2001 to 2026 (2020 missing) by discipline: GA artistic, GT trampoline, AC acro, AE aerobic. Rhythmic was not in the filter list.
  - Event URL: `/{year}/Artistic-{FIG idEvent}/en-us/Default`. The event id **matches the World Gymnastics id** (17247).
  - Ranking pages: `/Phase/Ranking/{20-digit phase id}`.
- **Completeness.** Full, as HTML.
  - Women's FX final columns: Rank, Bib, Name, Dif, Exe, Pen, Total ([page](https://gym.longinestiming.com/2026/Artistic-17247/en-us/Default/Phase/Ranking/00001801000200030004)).
  - The men's FX final adds **Bon (Bonus)**: "1 RICHARD Frederick USA 5.700 8.833 0.10 14.633" ([page](https://gym.longinestiming.com/2026/Artistic-17247/en-us/Default/Phase/Ranking/00001801000100030001)).
  - The download menu lists "Result Book" and per-apparatus results files. Their URLs were not exposed to the fetcher.
- **Coverage.** Only events Swiss Timing scores (Worlds, World Cups, World Challenge Cups, and similar). No Italian domestic events.
- **Freshness.** Live during competition (the event page has a "Live" view).
- **Access.** Public. From this devcontainer, `curl` timed out against both `www.longinestiming.com` and `gym.longinestiming.com`. Only the fetch tool reached them. Expect network flakiness in CI.
- **Licence / ToS.** The footer reads "© 2026 SWISS TIMING LTD, ALL RIGHTS RESERVED". No terms of use or legal notice page was found on the portal or by web search (Swiss Timing Ltd, UID CHE-101.296.855 per [onlineinfo.ch](https://onlineinfo.ch/company/swiss-timing-ltd---che-101-296-855/pdf)). **Status: do not reuse without permission.**
- **robots.txt.** `www.longinestiming.com/robots.txt` = `User-agent: * / Allow: /`. `gym.longinestiming.com/robots.txt` returns 404, which means no rules.
- **Stability.** Medium. The phase IDs are opaque, and the portal is a long-running ASP.NET-style site (2001 onward).
- **Cost.** €0.

### 4. European Gymnastics (UEG): `europeangymnastics.com`

- **What it is.** An Angular front-end with a Drupal 9 backend. Each event has a results page that lists PDFs on `new-backend.europeangymnastics.com/sites/default/files/paragraph/age-group-competition-info/competition-results/…`, for example `SENIORS - Individual - Qualification AllAroundResultsWag_10.pdf` ([WAG Zagreb 2026 results](https://www.europeangymnastics.com/event/2026-european-championships-womens-artistic-gymnastics-zagreb-cro/results), [RG Varna 2026 results](https://www.europeangymnastics.com/event/2026-european-championships-rhythmic-gymnastics-varna-bul/results)). The page says: "Results lists in PDF are published below after each competition". Live results go to SmartScoring.
- **Coverage.** European Championships (all disciplines, seniors and juniors).
- **Completeness.** PDF per phase and apparatus. We did not open a UEG PDF to confirm D/E; the World Gymnastics result book for the same event is the alternative.
- **Licence / ToS.** The footer reads "European Gymnastics © All rights reserved". There is a [privacy policy](https://www.europeangymnastics.com/page/privacy-policy) but no terms of use. **Status: permission needed.**
- **robots.txt.** `www.europeangymnastics.com/robots.txt` returns the SPA HTML shell, so there is no real file. The `backend.europeangymnastics.com/robots.txt` file is the Drupal default and doesn't block `/sites/default/files/`. `/jsonapi` returns 404.
- **Stability.** Low. Older search results point to `backend.` and the current pages point to `new-backend.`. File names carry Drupal `_N` suffixes.

### 5. SmartScoring: `results.smartscoring.com`

- **Coverage.** Live results for UEG events ([UEG results page](https://www.europeangymnastics.com/event/2026-european-championships-womens-artistic-gymnastics-zagreb-cro/results)). The site is an Angular SSR app. `/robots.txt` returns a "Page not found" HTML shell, so there is no file.
- **Completeness, API, licence.** **Unverified.** We did not probe it beyond the home page and robots.

### 6. Olympics.com / IOC

- **Access.** **Unreachable from this environment.** `curl` and the fetch tool both timed out on `olympics.com` pages and `robots.txt`. Retrying with a browser user agent was refused by the sandbox as bot-check circumvention, and we did not retry.
- **Licence / ToS (from search snippets, unverified).**
  - The [Terms of Service](https://olympics.com/en/terms-of-service) grant a limited licence "for informative purposes only" and allow sharing "for personal and non-commercial purposes".
  - The IOC FAQ says "no part of the site may be copied, republished, stored in a data search and retrieval system, reproduced or transmitted without the prior written authorisation of the IOC" ([IOC FAQ](https://olympics.com/ioc/faq/using-the-content-of-this-website/is-it-possible-to-use-the-content-texts-images-or-films-on-www-olympic-org)).
  - The structured Olympic Data Feed is a licensed product ([ODF Gymnastics Artistic data dictionary](https://odf.olympictech.org/2024-Paris/OG/PDF/PREV/ODF_GAR_Data_Dictionary.pdf)).
- **Status: do not reuse.** Olympic results are also in World Gymnastics (Paris 2024 is digital there), Olympedia and Wikipedia.

### 7. Federazione Ginnastica d'Italia (FGI): `federginnastica.it`

- **What it is.** A Joomla site. Results are post-event PDFs under `/images/documenti/{year}/…`, generated by "Proxima Centauri Informatica S.r.l" (footer). Examples:
  - [Serie A2 2025 Ancona, GAF classification](https://www.federginnastica.it/images/documenti/2025/1_ARTISTICA_MASCHILE_FEMMINILE/SERIE_A/ANCONA/serie_a2/Classifica_Campionato_GAF_A2.pdf): club totals per apparatus per stage (Montichiari, Ancona) plus the cumulative total.
  - [Assoluti 2025 Quartu S. Elena, GAF](https://www.federginnastica.it/images/documenti/2025/1_ARTISTICA_MASCHILE_FEMMINILE/ASSOLUTI/GAF/GAF_Classifica_Gara_2.pdf): per-athlete VT/UB/BB/FX scores and AA, for example "PEROTTI Giulia 55,750".
  - [Serie A1 2024](https://www.federginnastica.it/images/documenti/2024/GINNASTICA_ARTISTICA/2a_SERIE_A_ANCONA/SERIE_A1/Classifica_Campionato_GAF_A1.pdf). Note the different folder layout from 2025.
  - A yearly summary, [Risultati_2024.docx](https://www.federginnastica.it/images/documenti/2024/Risultati_2024.docx).
- **Coverage.** The only official source for **Serie A (A1/A2), the Assoluti, and other national championships**, for artistic and (by calendar) rhythmic.
- **Completeness.** Per-apparatus totals only. **No D/E in the PDFs sampled.** Numbers use a comma as the decimal separator.
- **Freshness.** The 2025 PDFs are dated on the day of the competition. **No 2026 PDF was found** by search, even though the 2026 Serie A finished in May ([The Gymternet](https://thegymter.net/2026/05/18/2026-italian-serie-a-final-results/)).
- **Access.** Public, but unreliable for machines. `curl` got HTTP **503 "Service unavailable"** on `www.federginnastica.it/robots.txt`, and the apex `federginnastica.it` served an **expired TLS certificate**. The fetch tool did get through.
- **Licence / ToS.** No terms, legal notice or copyright page was found (homepage footer and [search](https://www.federginnastica.it/)). An old FGI News colophon says published material "rimane di esclusiva proprietà della FGI" ([FGI News 2015/01](https://www.federginnastica.it/documentazioni/shared_file/FGI%20News/fginews2015_01/files/fginews2015_01.pdf), snippet). **Status: permission needed.** As an Italian federation, FGI is the natural partner to ask, and the podcast may already have a contact.
- **robots.txt.** Joomla default. It disallows `/administrator/ /api/ /bin/ /cache/ /cli/ /components/ /includes/ /installation/ /language/ /layouts/ /libraries/ /logs/ /modules/ /plugins/ /tmp/`. `/images/documenti/` is **not** disallowed.
- **Stability.** Low. The folder naming changes every year, with no index or feed.

### 8. Wikipedia (English and Italian)

- **Coverage.**
  - en.wiki has a full article per major event. The [2026 World Artistic Gymnastics Championships](https://en.wikipedia.org/wiki/2026_World_Artistic_Gymnastics_Championships) article has sections for medal standings, team, AA and each apparatus final, plus qualification tables, for men and women.
  - it.wiki has *Campionati italiani assoluti di ginnastica artistica* articles for 2010–2023 and a [Serie A1 GAF](https://it.wikipedia.org/wiki/Serie_A1_GAF) article (found via the it.wiki search API). No 2024–2026 Assoluti article showed in the top results; this is unverified.
- **Completeness.** Event-final tables have **D Score, E Score, Pen., Bon., Total** (wikitext checked). Qualification tables usually show per-apparatus totals.
- **Freshness.** The 2026 Worlds (ended 25 Oct) were complete by 10 Nov. Speed depends on volunteers.
- **Format / access.** MediaWiki Action API (`action=parse&prop=wikitext`) or REST HTML. Public. A descriptive User-Agent is required.
- **Licence.** Text is "available under the Creative Commons Attribution-ShareAlike License" ([Wikimedia Terms of Use §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)). Reuse needs **attribution** ("through hyperlink … or URL to the page", §7.7) and **share-alike**. Bare facts (scores) are arguably not copyrightable, but the tables as compiled should be treated as CC BY-SA. Automated use is fine unless "abusive or disruptive" (§4). API use must follow the User-Agent policy and API etiquette (§12).
- **robots.txt.** Blocks named abusive bots only. API use is governed by the policies above.
- **Stability.** Article URLs are stable. Table layout varies by editor and event, so parsing is brittle.

### 9. Wikidata

- **Coverage.** Each Paris 2024 artistic event exists as an item (for example Q117156642, women's AA). Athletes carry **World Gymnastics licence number (P2696)**, **World Gymnastics biography number (P7440)** and **Olympedia people ID (P8286)**.
- **Completeness.** Poor for results. A SPARQL query over the 15 Paris 2024 artistic events found 0–18 participants per event linked via `P1344` with qualifiers, and **0 with a score**.
- **Licence.** "All structured data … is released into the public domain" (CC0) ([Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)).
- **Access.** The query service has limits: 60 s per query, 60 s of processing per minute per client, 5 parallel queries per IP, 429 with `Retry-After` ([WDQS User Manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual#Query_limits)). Today (2026-11-10) a second query got **429 "Aggressively rate-limiting to 1 req / min – created during active wdqs outage"**.
- **robots.txt.** `query.wikidata.org/robots.txt` disallows `/sparql` for crawlers. That governs crawling. Programmatic API use falls under the WDQS policy above.
- **Use for us.** An ID crosswalk (World Gymnastics ↔ Olympedia ↔ Wikipedia), Italian names and photos. Not scores.

### 10. Olympedia

- **Coverage.** Olympic Games only, all disciplines, with full history. Paris 2024 is present, for example the [RG ribbon final](https://www.olympedia.org/results/2003765) with Raffaeli 7th and Baldassarri 8th.
- **Completeness.** Columns Points, Difficulty, Artistry, Execution, Penalty (RG). The artistic pages show D + E − penalty.
- **Licence / ToS.** The footer reads "© OlyMADMen 2006 — 2026". The [About](https://www.olympedia.org/static/about) and [FAQ](https://www.olympedia.org/static/faq) pages say nothing on reuse. The site opened to the public in 2020 with IOC permission ([The Sport Digest](https://thesportdigest.com/2020/05/comprehensive-olympic-data-back-in-public-domain-at-olympedia-org/)). Its predecessor, Sports-Reference Olympics, closed partly over "a change to our data licensing agreement". **Status: do not reuse without permission.**
- **robots.txt.** `User-agent: * / Crawl-delay: 10`.

### 11. UCSAS 2024 USOPC Data Challenge: `github.com/ucsas/gym2024data`

- **Verified.** The repo exists ([GitHub](https://github.com/ucsas/gym2024data)). Its README points to the [challenge page](https://statds.org/events/ucsas2024/challenge.html). Last push 2023-11-29. Not archived.
- **Coverage.** `cleandata/data_2022_2023.csv` has 24,434 rows (2.9 MB). `data_2017_2021.csv` is small (97 KB). MAG and WAG.
  - Events include the 2022 and 2023 Worlds, the 2022 and 2023 Europeans, World Cups and Challenge Cups, Pan Am, Asian, Commonwealth, US and British championships, among others. 563 rows are ITA athletes. No Italian domestic events.
- **Completeness.** One row per routine: `LastName, FirstName, Gender, Country, Date, Competition, Round, Location, Apparatus, Rank, D_Score, E_Score, Penalty, Score`. There is no bonus column. "A score of zero almost always indicates that the gymnast did not compete on that apparatus" (README).
- **Freshness.** Frozen at the 2023 Worlds.
- **Licence.** **None.** The GitHub API returns `license: null`. The README says the data was scraped from "the original PDF files" (official result books). **Status: do not reuse.** It could serve as a schema and parser reference for #188; the repo also contains R and Python scrapers. Read them, don't copy.

### 12. The Gymternet: `thegymter.net`

- **Coverage.** MAG and WAG news and results, worldwide and broad. It includes the **2026 Italian Serie A** stages and Final, the Città di Jesolo Trophy, gymnast and nation databases, and yearly "best scores" lists ([home](https://thegymter.net/), [Serie A Final 2026](https://thegymter.net/2026/05/18/2026-italian-serie-a-final-results/)).
- **Completeness.** HTML tables of per-apparatus totals and AA, plus team totals. No D/E in the Serie A sample. No source is credited.
- **Freshness.** Fast. The Serie A Final (16–17 May 2026) was posted on 18 May.
- **Licence.** Hosted on WordPress.com, whose terms say: "We don't own your content, and you retain all ownership rights you have in the content you post" ([Automattic ToS §8](https://automattic.com/tos)). The site shows no reuse licence. **Status: do not reuse.** It is useful as an editorial reference and for cross-checking.
- **robots.txt.** WordPress.com default. Content paths are allowed.

### 13. gymnasticsresults.com

- **Coverage.** MAG and WAG elite events, 2000–2026, including the 2026 Worlds, Euros and Commonwealth Games ([home](https://gymnasticsresults.com/)). Run by a volunteer ([About](https://gymnasticsresults.com/about)).
- **Completeness.** Medallist lists plus **rehosted official PDFs** (for example `documents/wag/aafinal.pdf` on the [2026 Worlds page](https://gymnasticsresults.com/results/2026/worlds/)).
- **Data-quality flag.** The homepage lists the 2026 men's Europeans under a "2020" date label.
- **Licence / robots.** The `robots.txt` is a Cloudflare "Content-Signal" block, `search=yes, ai-train=no, use=reference`. It declares itself an "express reservation of rights under Article 4 of the EU Directive 2019/790". It also disallows ClaudeBot, GPTBot, CCBot and others. **Status: do not reuse.**

### 14. Kaggle / TidyTuesday "120 years of Olympic history"

- **What it is.** Olympic athletes and medals, 1896–2016. **Medals only, no scores.** The TidyTuesday README says it was "scraped … from www.sports-reference.com in May 2018" ([TidyTuesday 2024-08-06](https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-08-06)). The TidyTuesday repo is CC0, but that label cannot license data that was scraped from a site whose own data licence was withdrawn. **Status: do not reuse.**

### Not covered or not reachable

- `ginnasticando.it` returned 403.
- `kscore.ch` and `ginnastica.info` do not resolve.
- No public Italian live-scoring platform for Serie A was found. OA Sport ran written live blogs in 2020 ([OA Sport](https://www.oasport.it/2020/10/ginnastica-artistica-serie-a-senza-diretta-tv-e-streaming-differita-su-dazn-diretta-live-scritta-e-cronaca-su-oa-sport/)).

## Recommendation (ranked)

1. **Primary: official World Gymnastics data, conditional on written permission.** Use the JSON API as the event index and for totals and ranks per apparatus, and the result-book PDF (or Longines HTML) for the D/E/bonus/penalty breakdown.
   - **Why:** it has the widest coverage (all disciplines, all FIG-sanctioned events, 2009 onward) and freshness of 2 days or less. It is the authoritative source, and its results match Longines and Wikipedia exactly. A single `idEvent` joins the JSON, the result book and Longines.
   - **The condition:** no reuse terms exist, and Swiss Timing reserves all rights. Before #188 builds on it, **Guido should email World Gymnastics (media/communications)** to ask for permission to republish results on a non-commercial Italian blog with attribution. We do not send that email.
   - **Engineering caveat:** the API is undocumented and internal to the frontend. Pin snapshots in the repo, which the committed-content pipeline already does, and expect breakage.
2. **Fallback: English Wikipedia (scores) + Wikidata (IDs).**
   - **Why:** these are the only openly licensed sources. Final tables carry D/E/Pen/Bon, and their figures match the official data.
   - **Costs:** CC BY-SA attribution plus share-alike on the stats page. Brittle wikitext parsing. Volunteer lag. Thin coverage beyond major events.
   - **If permission is refused or never arrives, the fallback becomes the primary.**
3. **Italian events: FGI PDFs, again conditional on permission.** Ask FGI in the same round of emails. If the answer is yes, an Italian stats page could be the differentiator, since no other site has Serie A in structured form. If the answer is no, Italian domestic stats are out of scope for v1, and The Gymternet stays an editorial reference only.

## Gaps

- **No machine-readable source for Italian domestic competitions** (Serie A1/A2, Assoluti, Gold/Silver). FGI publishes PDFs only, with paths that change each year, and it publishes no 2026 PDFs that we could find.
- **No source has D/E scores for Italian domestic events.** FGI PDFs and The Gymternet give per-apparatus totals only.
- **No structured feed for the 2026 European Championships (MAG/WAG).** World Gymnastics has `digitalresult: false` for them. The scores exist only in PDFs (World Gymnastics result book and UEG), unless SmartScoring exposes something. That is unverified.
- **D/E is never in JSON.** It is in PDFs (World Gymnastics, UEG), Longines HTML and Wikipedia tables only. Any per-routine stats need PDF or HTML parsing.
- **No openly licensed official source.** Every official publisher is either silent on reuse or reserves all rights.
- **AA apparatus breakdown endpoint** returned empty for the one ID tested. Untested further.
- **Rhythmic and trampoline:** World Gymnastics covers both (RGI/RGG, TRA/TUM/DMT in the API). The Longines portal lists GT trampoline but no rhythmic filter. UEG has RG PDFs. We did not check completeness of the RG and TRA score breakdowns.
- **Olympics.com** could not be checked at all from this environment.

## Sources we must NOT reuse (without written permission)

| Source | Why |
|---|---|
| Olympics.com / IOC / ODF | ToS: personal, non-commercial, informative use only. Copying requires the IOC's "prior written authorisation" (snippet, unverified). ODF is a licensed feed |
| Longines / Swiss Timing | "All rights reserved". No terms grant reuse |
| gymnasticsresults.com | Express EU DSM art. 4 reservation in robots.txt. Blocks AI agents. Rehosts others' PDFs |
| Kaggle / TidyTuesday "120 years" | Scraped from Sports-Reference. A CC0 label on a scrape doesn't clear the provenance |
| UCSAS `gym2024data` | No licence. Data scraped from official PDFs |
| The Gymternet | Author retains all rights (WordPress.com ToS). No licence |
| Olympedia | © OlyMADMen. No reuse terms. Public access granted by the IOC to the site, not to reusers |

Permission needed before use (silent, not prohibited): **World Gymnastics (API + PDFs)**, **European Gymnastics**, **FGI**, **SmartScoring**.

Free to reuse with conditions: **Wikipedia** (CC BY-SA 4.0, attribution plus share-alike), **Wikidata** (CC0).

## Notes for #188 (extraction spike)

- Join key: World Gymnastics `idEvent` = Longines `Artistic-{id}`. The result book comes from `resultbook` → `asset.php?id=fidb_{n}`.
- Score schema needs **D, E, bonus, penalty, total** (the men's 2025–28 code has a bonus column), plus phase (qual/semi/final), apparatus, rank, and the "did not compete" zero (UCSAS convention).
- Handle country attribution: WG2 is attributed to RUS (2026 Worlds). Note that `AIN` is used elsewhere; unverified.
- Use a descriptive User-Agent and low request rates everywhere. Respect Olympedia's `Crawl-delay: 10` and Wikidata's 429/`Retry-After`.
- Expect network flakiness: `curl` from this devcontainer timed out against Longines and olympics.com, and FGI returned 503.
- Do not store organiser contact fields from `/api/sportevents/{id}/`. Athlete birth dates (World Gymnastics licence DB) are personal data, so keep only what the page needs.

## Sources

- World Gymnastics results page: <https://www.gymnastics.sport/site/events/searchresults.php>
- World Gymnastics event results (2026 Worlds): <https://www.gymnastics.sport/site/events/results.php?idEvent=17247>
- World Gymnastics API (examples): <https://www.gymnastics.sport/api/sporteventswithresult/?from=2025-01-01&to=2026-11-10>, <https://www.gymnastics.sport/api/sportevents/17247/results/?ageCategory=2&category=58>
- World Gymnastics result book (2026 Worlds): <https://www.gymnastics.sport/asset.php?id=fidb_24169>
- World Gymnastics privacy notice: <https://www.gymnastics.sport/site/pages/privacy.php>
- World Gymnastics robots.txt: <https://www.gymnastics.sport/site/robots.txt>
- FIG Licence Rules 2023 (third-party copy): <https://www.gymnastics-history.com/wp-content/uploads/2026/01/en_1.5-Licence-Rules-Edition-2023.pdf>
- FIG → World Gymnastics rebrand: <https://www.insidegymnastics.com/news-features/international-gymnastics-federation-fig-unveils-new-global-identity-world-gymnastics/>
- Longines gymnastics portal: <https://gym.longinestiming.com/>; 2026 Worlds: <https://gym.longinestiming.com/2026/Artistic-17247/en-us/Default>
- Longines robots.txt: <https://www.longinestiming.com/robots.txt>
- Swiss Timing company record: <https://onlineinfo.ch/company/swiss-timing-ltd---che-101-296-855/pdf>
- European Gymnastics results: <https://www.europeangymnastics.com/event/2026-european-championships-womens-artistic-gymnastics-zagreb-cro/results>, <https://www.europeangymnastics.com/event/2026-european-championships-rhythmic-gymnastics-varna-bul/results>
- European Gymnastics backend robots.txt: <https://backend.europeangymnastics.com/robots.txt>
- SmartScoring live results: <https://results.smartscoring.com/>
- Olympics.com Terms of Service: <https://olympics.com/en/terms-of-service>
- IOC content-use FAQ: <https://olympics.com/ioc/faq/using-the-content-of-this-website/is-it-possible-to-use-the-content-texts-images-or-films-on-www-olympic-org>
- ODF Artistic Gymnastics data dictionary (Paris 2024): <https://odf.olympictech.org/2024-Paris/OG/PDF/PREV/ODF_GAR_Data_Dictionary.pdf>
- FGI homepage: <https://www.federginnastica.it/>; robots.txt: <https://www.federginnastica.it/robots.txt>
- FGI Serie A2 2025: <https://www.federginnastica.it/images/documenti/2025/1_ARTISTICA_MASCHILE_FEMMINILE/SERIE_A/ANCONA/serie_a2/Classifica_Campionato_GAF_A2.pdf>
- FGI Assoluti 2025: <https://www.federginnastica.it/images/documenti/2025/1_ARTISTICA_MASCHILE_FEMMINILE/ASSOLUTI/GAF/GAF_Classifica_Gara_2.pdf>
- FGI Serie A1 2024: <https://www.federginnastica.it/images/documenti/2024/GINNASTICA_ARTISTICA/2a_SERIE_A_ANCONA/SERIE_A1/Classifica_Campionato_GAF_A1.pdf>
- FGI News 2015/01: <https://www.federginnastica.it/documentazioni/shared_file/FGI%20News/fginews2015_01/files/fginews2015_01.pdf>
- Wikipedia, 2026 Worlds: <https://en.wikipedia.org/wiki/2026_World_Artistic_Gymnastics_Championships>
- Wikipedia, Serie A1 GAF: <https://it.wikipedia.org/wiki/Serie_A1_GAF>
- Wikimedia Terms of Use: <https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use>
- Wikidata licensing: <https://www.wikidata.org/wiki/Wikidata:Licensing>
- WDQS query limits: <https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual#Query_limits>
- Wikidata query service robots.txt: <https://query.wikidata.org/robots.txt>
- Olympedia: <https://www.olympedia.org/static/about>, <https://www.olympedia.org/static/faq>, <https://www.olympedia.org/results/2003765>, <https://www.olympedia.org/robots.txt>
- Olympedia public opening: <https://thesportdigest.com/2020/05/comprehensive-olympic-data-back-in-public-domain-at-olympedia-org/>
- UCSAS challenge: <https://statds.org/events/ucsas2024/challenge.html>; data: <https://github.com/ucsas/gym2024data>
- The Gymternet: <https://thegymter.net/>, <https://thegymter.net/2026/05/18/2026-italian-serie-a-final-results/>, <https://thegymter.net/robots.txt>
- Automattic / WordPress.com Terms: <https://automattic.com/tos>
- gymnasticsresults.com: <https://gymnasticsresults.com/>, <https://gymnasticsresults.com/about>, <https://gymnasticsresults.com/results/2026/worlds/>, <https://gymnasticsresults.com/robots.txt>
- TidyTuesday Olympics dataset: <https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-08-06>
- OA Sport Serie A live coverage (2020): <https://www.oasport.it/2020/10/ginnastica-artistica-serie-a-senza-diretta-tv-e-streaming-differita-su-dazn-diretta-live-scritta-e-cronaca-su-oa-sport/>
