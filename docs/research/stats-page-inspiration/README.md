# How sport sites present statistics (inspiration for `/statistiche`)

> Research output for issue [#186](https://github.com/gweedo/allarounder/issues/186), part of the stats page work in [#185](https://github.com/gweedo/allarounder/issues/185). Date: **2026-11-10**. No code changes. Data sources, licensing and robots.txt are #187's job and are only touched on here where they affected what could be inspected.

Twelve sites were attempted and ten could be inspected. Six are gymnastics sources: FIG, Olympedia, The Gymternet, European Gymnastics, Federazione Ginnastica d'Italia (FGI) and Italian Wikipedia. Four are other sports sites known for stats UX: Basketball-Reference, StatsF1, Tennis Abstract and Transfermarkt. Two could not be accessed: FBref and Olympics.com. ProCyclingStats was tried as a replacement and was blocked too.

The finding that best separates the sites is simple: **are the numbers in the HTML?** For gymnastics, the most useful data is usually *not* crawlable. FIG event results are rendered client-side by Vue. European Gymnastics and FGI publish results only as PDFs. Olympedia and Wikipedia are the gymnastics pages where every score is plain HTML. They are also the pages that rank. For a static site that is a real opening: a crawlable HTML table of Italian gymnastics results, with Italian labels, is something the official bodies don't offer.

## Method

- **Inspected raw** (page source downloaded with `curl`, then the `<title>`, JSON-LD, microdata, canonical, viewport meta and `<table>` markup checked): FIG, Olympedia, European Gymnastics, FGI, Basketball-Reference, StatsF1, Tennis Abstract, Transfermarkt, it.wikipedia, plus the Gymternet **homepage** only.
- **Summarized by WebFetch** (a summarizing model reads the page, so no raw source): Gymternet athlete, meet and best-scores pages, the European Gymnastics event overview, and the Google Search Central docs. Claims from these are tagged *(WebFetch summary)*.
- **Mobile behaviour** was **inferred from markup and CSS** (viewport meta, overflow rules, fixed pixel widths). Nothing was rendered on a phone, so every mobile claim below is an inference, not an observation.
- No site was fetched in a way that bypasses a bot check. Where a site blocked the fetch, this doc says so and doesn't describe it from memory.

## Gymnastics sites

### FIG (World Gymnastics), gymnastics.sport

Athlete page: [BARTOLINI Nicola – FIG Athlete Profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187). Results search: [searchresults.php](https://www.gymnastics.sport/site/events/searchresults.php). Event results: [results.php?idEvent=18178](https://www.gymnastics.sport/site/events/results.php?idEvent=18178).

- **Stats shown.** The athlete profile has three tabs: Identity, Results, Media. Identity is a grid of fact boxes (nation, year of birth, discipline, club, coach) plus long sourced bio notes (injuries, milestones, idols), each with its source and date ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187)). Results are grouped by competition tier ("Olympic Games", "World Championships"). Inside each tier there is one collapsible block per edition (for example "2021 – 50th FIG Artistic Gymnastics World Championships KITAKYUSHU (JPN)"). Each block has a panel per apparatus with Rank Final, Score Final, Rank Qualif. and Score Qualif. ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187)). There are no charts, no D/E breakdown on the profile, and no medal summary.
- **URLs.** Query-string IDs, not slugs: `bio_detail.php?id=32187`, `results.php?idEvent=…` ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187), [event](https://www.gymnastics.sport/site/events/results.php?idEvent=18178)).
- **Crawlable HTML vs JS.** Mixed. The athlete results tab **is** server-rendered: every rank and score is in the HTML source, just inside a hidden tab ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187)). The results search and event results pages are **JS-only**. Their source contains Vue templates (`{{ result.scorefinal | formatresult }}`, `{{ gymnast.lastname }}`) rather than numbers ([event](https://www.gymnastics.sport/site/events/results.php?idEvent=18178), [search](https://www.gymnastics.sport/site/events/searchresults.php)).
- **SEO signals.** Title "BARTOLINI Nicola – FIG Athlete Profile", a meta description identical to the title, no canonical, no JSON-LD, no microdata ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187)). Event pages have the title "World Gymnastics – Results – 18178", with a number where the event name should be ([event](https://www.gymnastics.sport/site/events/results.php?idEvent=18178)).
- **Mobile (inferred).** Responsive viewport meta, and results are in stacked Bootstrap panels rather than wide tables, so nothing has to scroll sideways ([profile](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187)).
- **Worth copying.** Group an athlete's results by competition tier, then edition, then apparatus, and show qualification next to final. **Not worth copying:** numeric event titles, and Vue-rendered results tables.

### Olympedia

Athlete: [Simone Biles](https://www.olympedia.org/athletes/132107). Event: [Balance Beam, Women, 2024](https://www.olympedia.org/results/2012287). Tools: [Head-to-head](https://www.olympedia.org/countries/head_to_head).

- **Stats shown.** The athlete page has a biographical block, a medal summary box (OG Gold 7 / Silver 2 / Bronze 2 / Total 11), and one results table with the columns Games, Discipline/Event, NOC/Team, Pos, Medal. Rows are grouped by Games ([Biles](https://www.olympedia.org/athletes/132107)). A "List mentions" section links the athlete to curated record lists, such as "Artistic Gymnasts Who Won More Than One Olympic Title in the Same Event in Non-Consecutive Games" ([Biles](https://www.olympedia.org/athletes/132107)). The event page opens with an event fact box (date, venue, "78 from 34 countries") and a **written narrative of the final**. Then come full tables for each round, with Points, Difficulty Score, Execution Score and Penalty columns, plus a judges panel table ([Beam 2024](https://www.olympedia.org/results/2012287)).
- **Navigation.** The event page has two cross-links: "Other 2024 artistic gymnastics events" and "In other Games 1952 … 2020". Together they give a grid of the same apparatus across editions and the same edition across apparatus ([Beam 2024](https://www.olympedia.org/results/2012287)). A Statistics menu leads to medals by country, medals by athlete, medal tables, Olympic records and age records (`/statistics/medal/athlete`, `/statistics/medal_table`, `/statistics/age`) ([Beam 2024](https://www.olympedia.org/results/2012287)). Head-to-head and results comparison are form-driven tools ([Head-to-head](https://www.olympedia.org/countries/head_to_head)).
- **URLs.** Numeric IDs per entity type: `/athletes/{id}`, `/results/{id}`, `/editions/{id}`, `/countries/{code}` ([Beam 2024](https://www.olympedia.org/results/2012287)).
- **Crawlable HTML vs JS.** Fully server-rendered: plain `<table class="table table-striped">` with every number in the source, and the pages are small (16 KB athlete, 84 KB event) ([Biles](https://www.olympedia.org/athletes/132107), [Beam 2024](https://www.olympedia.org/results/2012287)).
- **SEO signals.** Title "Olympedia – Simone Biles". No meta description, no canonical, no JSON-LD ([Biles](https://www.olympedia.org/athletes/132107)). robots.txt sets `Crawl-delay: 10` for all agents ([robots.txt](https://www.olympedia.org/robots.txt)).
- **Mobile (inferred).** No viewport meta tag, so phones get the desktop layout scaled down ([Biles](https://www.olympedia.org/athletes/132107)).
- **Worth copying.** The written narrative above the result table: it is the blog's strength, and it gives a stats page unique text to rank on. Also the "same event, other years" strip, the medal-count box, and curated record lists linked from athlete pages.

### The Gymternet (thegymter.net)

Homepage: [thegymter.net](https://thegymter.net/). Athlete: [Alice D'Amato](https://thegymter.net/alice-damato/). Leaderboard: [The Best Scores in 2023: March Update](https://thegymter.net/2023/03/14/the-best-scores-in-2023-march-update/). Meet: [2025 Italian Championships](https://thegymter.net/2025-italian-championships/).

- **Fetch status.** `curl` got the homepage (HTTP 200), but the article and athlete pages returned **403**, so only the homepage source was inspected. Everything else below is *(WebFetch summary)*.
- **Stats shown.** Athlete pages have a short bio block (full name, nation, birthdate, status), then **one results table per year** from 2025 back to 2015. Columns are Date, Competition, a round label (AA / QF / TF / EF), VT, UB, BB, FX, AA, with "——" for an event not competed. There is no rank column and no chart ([D'Amato](https://thegymter.net/alice-damato/), *WebFetch summary*). "Best scores" posts are season leaderboards, one ranked table per apparatus (all-around, single vault, vault average, bars, beam, floor) plus difficulty-only tables. Columns are Rank, Athlete, Nation, Meet, Score, and juniors are marked with an asterisk ([Best scores 2023](https://thegymter.net/2023/03/14/the-best-scores-in-2023-march-update/), *WebFetch summary*). Meet pages are hubs that link to separate women's and men's results posts and live blogs ([2025 Italian Championships](https://thegymter.net/2025-italian-championships/), *WebFetch summary*).
- **URLs.** Readable slugs: `/{athlete-name}/`, `/{year}-{competition}/` ([D'Amato](https://thegymter.net/alice-damato/), *WebFetch summary*).
- **SEO signals.** The homepage has WordPress-style JSON-LD (`WebSite`, `Organization`, `SearchAction`) and a responsive viewport ([homepage](https://thegymter.net/)). For athlete and meet pages, JSON-LD, canonical and viewport are **unverified** (source blocked).
- **Mobile.** Unverified.
- **Worth copying.** This is the closest model to us: a small editorial team, a blog, hand-maintained data. Copy the year-by-year apparatus table on athlete pages, and the periodic "best scores" leaderboard per apparatus (a snapshot, refreshed when someone updates it, not live).

### European Gymnastics, europeangymnastics.com

Events: [events](https://www.europeangymnastics.com/events). Event results tab: [2025 Artistic Europeans – Leipzig, results](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results).

- **Stats shown.** An event page has the tabs Overview, News, Schedule, Results, Galleries. The Results tab is a list of **PDF links**: a start list and a results PDF per apparatus (Team, All-around, Vault, Uneven bars, Beam, Floor, and the six men's apparatus, plus Mixed Team), and a "Full result book". There are 27 PDF links on the Leipzig 2025 page ([results tab](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results)). There is no HTML results table, medal table or athlete page ([results tab](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results)).
- **URLs.** Readable slugs: `/event/{year}-{name}-{city}-{country}/results` ([events](https://www.europeangymnastics.com/events)).
- **SEO signals.** The event title is meaningful ("2025 Men's and Women's Artistic Europeans – Leipzig (GER) | European Gymnastics"), but there is no canonical, no meta description and no JSON-LD ([results tab](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results)). The numbers live only in PDFs.
- **Mobile.** Responsive viewport. PDFs are the mobile experience ([results tab](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results)).
- **Worth copying.** The per-apparatus split of an event, and readable event slugs. **Not:** PDF-only results.

### Federazione Ginnastica d'Italia, federginnastica.it

Rankings: [Classifiche](https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html).

- **Fetch status.** The first request returned HTTP **503** and a retry returned 200, so the site may be intermittently unavailable to automated clients ([homepage](https://www.federginnastica.it/)).
- **Stats shown.** "Classifiche" is a filterable list (Anno 2005–2027, Disciplina, Fase from Internazionale to Provinciale, Comitato regionale). Each row (season, discipline, date, individual or team, championship name, committee) has a "Scarica" link to a **PDF** under `/fgi_files/` ([Classifiche](https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html)). No HTML scores, athlete pages or medal tables.
- **SEO signals.** Joomla. The title is just "Classifiche", with no meta description, canonical or JSON-LD ([Classifiche](https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html)).
- **Worth copying.** The Italian vocabulary for filters and labels (Stagione, Disciplina, Fase, Individuale/Squadre, Classifiche). The coverage of Italian domestic competitions (Serie A, regional championships) is a gap we could fill with HTML, subject to #187's licensing check. **Not:** PDF-only results, or server-side faceted filtering.

### Italian Wikipedia, it.wikipedia.org

Athlete: [Alice D'Amato](https://it.wikipedia.org/wiki/Alice_D%27Amato). Event: [Ginnastica ai Giochi della XXXIII Olimpiade – Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave).

- **Stats shown.** The athlete page has an infobox ("sinottico") with height, speciality, club and palmarès. The "Risultati" section has `wikitable` tables with the columns Anno, Competizione, Squadra, Individuale, Volteggio, Parallele, Trave, Corpo libero ([D'Amato](https://it.wikipedia.org/wiki/Alice_D%27Amato)). The event page has an infobox (Luogo, Periodo, Partecipanti, Podio) and one table per round: Pos., Ginnasta, Nazionalità, D. Score, E. Score, Penalità, Totale, Note. Navboxes at the bottom link every apparatus and edition ([Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave)).
- **URLs.** Readable Italian titles, one page per apparatus per Games ([Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave)).
- **SEO signals.** Canonical present, JSON-LD `Article` (not `SportsEvent` or `Person`), all tables server-rendered ([D'Amato](https://it.wikipedia.org/wiki/Alice_D%27Amato), [Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave)).
- **Mobile (inferred).** The desktop page sets `viewport width=1120`. Mobile readers are served a separate mobile site, which was not inspected ([D'Amato](https://it.wikipedia.org/wiki/Alice_D%27Amato)).
- **Worth copying.** This is the main Italian-language competitor for our search terms, and the best source of **Italian column labels**: Volteggio, Parallele asimmetriche, Trave, Corpo libero, Sbarra, Parallele simmetriche, Anelli, Cavallo con maniglie, D. Score, E. Score, Penalità, Totale ([Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave)).

## Other sports sites

### Basketball-Reference (Sports-Reference family)

Player: [LeBron James](https://www.basketball-reference.com/players/j/jamesle01.html). Season: [2023-24 NBA Season Summary](https://www.basketball-reference.com/leagues/NBA_2024.html).

- **Stats shown.** A player page has a bio block (`#meta`), then many stat tables (Per Game, Totals, Per 36, Per 100 Poss, Advanced, Shooting, Play-by-Play…), 27 `<table>` elements in all. Each has an `<h2>` heading, a `<caption>`, one row per season, and a career summary row ([player](https://www.basketball-reference.com/players/j/jamesle01.html)). Column headers carry a `data-tip` glossary tooltip (1,024 on the page) and every cell has a `data-stat` key ([player](https://www.basketball-reference.com/players/j/jamesle01.html)). Tables are client-sortable (`class="stats_table sortable"`) ([player](https://www.basketball-reference.com/players/j/jamesle01.html)). Season pages have 40 tables ([season](https://www.basketball-reference.com/leagues/NBA_2024.html)).
- **URLs.** Hierarchical and readable: `/players/{initial}/{id}.html`, with sub-pages `/players/j/jamesle01/gamelog/`, `/splits/`, `/shooting/`; seasons are `/leagues/NBA_2024.html` ([player](https://www.basketball-reference.com/players/j/jamesle01.html)).
- **Crawlable HTML vs JS.** Server-rendered tables. A detail worth knowing: some secondary tables ship **inside HTML comments** (`setup_commented commented` wrappers, 111 comments on the page) and JS un-comments them, which keeps the first paint light ([player](https://www.basketball-reference.com/players/j/jamesle01.html)).
- **SEO signals.** Descriptive title ("LeBron James Stats, Height, Weight, Position, Draft Status and more"), canonical, `og:description`, JSON-LD `Person` (birthDate, birthPlace, height, `memberOf` SportsTeam), JSON-LD `FAQPage`, and microdata `BreadcrumbList` ([player](https://www.basketball-reference.com/players/j/jamesle01.html)). Since 2023 Google shows FAQ rich results only for "well-known, authoritative government and health websites", so the FAQPage markup brings little ([Google, Aug 2023](https://developers.google.com/search/blog/2023/08/howto-faq-changes)).
- **Mobile (inferred from CSS).** `.table_container{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}`, so wide tables scroll sideways inside their container rather than breaking the page. A second rule sets `overflow-x:hidden`, probably at a desktop breakpoint (unverified) ([sr-min.css](https://cdn.ssref.net/req/202611091/css/bbr/sr-min.css)).
- **Worth copying.** Semantic `<table>` with `<caption>`, a scroll container, a glossary tooltip on abbreviated headers (D, E, VT…), a career/total row, BreadcrumbList, and progressive-enhancement sorting. **Not:** 27 tables per page, or tables hidden in comments.

### StatsF1

Driver: [Lewis Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx).

- **Stats shown.** A dashboard of **headline counters with percentages**: "400 Grands Prix", "106 wins (26.50 %)", "105 pole positions (26.25 %)", "209 podiums (52.25 %)", points per GP. There is a strip of championship position per season (2007 → 2 … 2026 → 4), and two **histograms** of finishing and grid positions with averages ("Rank on finish line, Average: 3,87") ([Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx)). Drill-down sub-pages exist for every counter: `/en/lewis-hamilton/classement-p1.aspx` (each P1 finish), `/grille-p10.aspx`, `/coequipier.aspx` (teammates), `/abandon.aspx` (retirements) ([Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx)).
- **Charts.** The histograms are **plain HTML/CSS**: `<div>` bars with inline heights and the count as text, with no `<svg>`, `<canvas>` or chart library, so the numbers are crawlable ([Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx)).
- **SEO signals.** Title "Lewis HAMILTON • STATS F1". No meta description, canonical or JSON-LD ([Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx)).
- **Mobile (inferred).** The bars are positioned with absolute pixel offsets (`left:783px`, `left:891px`), so the histogram is fixed-width and will overflow narrow screens ([Hamilton](https://www.statsf1.com/en/lewis-hamilton.aspx)).
- **Worth copying.** Headline counters with a percentage ("12 finali, 4 medaglie (33%)"), and CSS-only bar charts whose numbers stay in the HTML, but with percentage widths instead of pixel offsets.

### Tennis Abstract

Player: [Jannik Sinner](https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner).

- **Stats shown.** The title promises "Match Results, Splits, and Analysis" ([Sinner](https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner)).
- **Crawlable HTML vs JS.** **JS-only.** With scripts removed, the visible text is just the title. The data ships as a per-player JS file (`/jsfrags/JannikSinner.js`) and is rendered by jQuery plus `jquery.tablesorter.js` ([Sinner](https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner)).
- **SEO signals.** A good title, but no meta description, canonical, JSON-LD or viewport ([Sinner](https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner)).
- **Worth copying.** The idea of **one precomputed data file per athlete** maps neatly onto a build step. Render it to HTML at build time, though, not in the browser.

### Transfermarkt

Player: [Mohamed Salah](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455).

- **Stats shown.** A profile header with key facts (age, height, position, club, contract, caps/goals, market value with a "Last update" date). Market-value history, matches, absences and player comparison are **custom web components** (`<tm-market-value-development-graph-integrated>`, `<tm-matches>`, `<tm-absences>`, `<tm-player-compare>`) filled client-side ([Salah](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455)).
- **URLs.** A readable slug plus ID, with the page type in the path: `/{name}/profil/spieler/{id}`, `/{name}/marktwertverlauf/spieler/{id}`, `/{name}/erfolge/spieler/{id}` (honours) ([Salah](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455)).
- **SEO signals.** Canonical, a templated meta description ("Mohamed Salah, 34, from Egypt ➤ … ➤ Market value: €17.00M"), `hreflang` alternates for many locales, and schema.org `Person` **microdata** (birthDate, birthPlace, height, nationality, affiliation) ([Salah](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455)).
- **Mobile (inferred).** `user-scalable=no` in the viewport meta, which blocks pinch-zoom, an accessibility anti-pattern ([Salah](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455)).
- **Worth copying.** A meta description generated from data, a dated "ultimo aggiornamento" label, and the slug + page-type URL pattern. **Not:** JS-only graphs, or disabling zoom.

## Sites that could not be accessed

- **FBref** ([player page tried](https://fbref.com/en/players/e342ad68/Mohamed-Salah)): Cloudflare "Just a moment…" challenge with HTTP 403 for both curl and WebFetch. Not evaluated.
- **Olympics.com** ([athlete page tried](https://www.olympics.com/en/athletes/simone-biles)): HTTP 403 for curl, WebFetch timeouts on three URLs. Not evaluated.
- **ProCyclingStats** ([rider page tried](https://www.procyclingstats.com/rider/tadej-pogacar)), tried as a replacement: Cloudflare challenge, HTTP 403. Not evaluated.

## Summary comparison

| Site | Main stat views | Numbers in HTML? | Mobile handling (inferred) | Structured data | URL style |
|---|---|---|---|---|---|
| FIG | Athlete results by tier → edition → apparatus; event results | Athlete tab: yes. Event/search: **no** (Vue) | Stacked panels, responsive | None | `?id=` query strings |
| Olympedia | Athlete results + medal box; event narrative + D/E/penalty tables; stats lists | Yes | No viewport meta | None | `/athletes/{id}` |
| The Gymternet | Year-by-year apparatus table; season best-score leaderboards | Unverified (WebFetch only) | Unverified | WebSite/Organization (homepage) | `/{year}-{meet}/`, `/{athlete}/` |
| European Gymnastics | Per-apparatus start lists/results | **No** (PDF) | PDFs | None | `/event/{slug}/results` |
| FGI | Filterable list of rankings | **No** (PDF) | PDFs | None | Joomla paths |
| it.wikipedia | Palmarès table; per-round D/E/Pen./Totale tables | Yes | Separate mobile site | `Article` | Italian titles |
| Basketball-Reference | Season-by-season tables, glossary tips, sortable | Yes (some in comments) | `overflow-x:auto` container | `Person`, `FAQPage`, `BreadcrumbList` | `/players/j/{id}.html` |
| StatsF1 | Headline counters with %, CSS histograms, drill-downs | Yes | Fixed-px charts overflow | None | `/en/{driver}/{stat}.aspx` |
| Tennis Abstract | Results, splits | **No** (JS data file) | No viewport | None | `?p=` query string |
| Transfermarkt | Profile facts, value graph, compare | Facts yes; graphs **no** | Zoom disabled | `Person` microdata, hreflang | `/{name}/{type}/spieler/{id}` |

## Recommended patterns (shortlist)

Each of these works with `output: "export"`: build-time data, HTML output, no request-time server.

1. **Athlete page with year-by-year apparatus results.** One table per season (or a season column), with columns for round (Qualifica / Finale), each apparatus (Volteggio, Parallele, Trave, Corpo libero), and Totale. Add a medal-count box at the top and group by competition tier. Sources: [The Gymternet](https://thegymter.net/alice-damato/), [FIG athlete Results tab](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187), [Olympedia](https://www.olympedia.org/athletes/132107), [it.wikipedia](https://it.wikipedia.org/wiki/Alice_D%27Amato).
2. **Event/apparatus page: narrative, full results table, cross-links.** A few lines of editorial text (our writers' strength), then the ranked table with D, E, Penalità and Totale, and linked athlete names. Add "stesso attrezzo, altre edizioni" and "altri attrezzi, stessa gara" link strips. Sources: [Olympedia Balance Beam 2024](https://www.olympedia.org/results/2012287), [it.wikipedia Trave](https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave), the per-apparatus split at [European Gymnastics](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results).
3. **Season best-scores leaderboard per apparatus.** A periodic snapshot ("aggiornato al …"), one ranked table per apparatus with Atleta, Nazione, Gara, Punteggio. It fits a nightly or per-competition rebuild, and gives a reason to come back between episodes. Sources: [The Gymternet best scores](https://thegymter.net/2023/03/14/the-best-scores-in-2023-march-update/), with a dated label like [Transfermarkt's "Last update"](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455).
4. **Headline counters plus CSS-only bar charts.** "14 finali · 5 medaglie (36%)", with a finishing-position histogram drawn as HTML `<div>` bars sized in `%`, so the numbers stay crawlable text and need no chart library. Sources: [StatsF1](https://www.statsf1.com/en/lewis-hamilton.aspx), [Olympedia medal box](https://www.olympedia.org/athletes/132107).
5. **Accessible, scrollable, semantic tables.** A real `<table>` with a `<caption>`, wrapped in an `overflow-x:auto` container, with abbreviation tooltips (`<abbr title="Difficoltà">D</abbr>`), a total row, and sorting only as progressive enhancement. Add `BreadcrumbList` JSON-LD, which Google supports ([search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)), and a meta description built from the data. Sources: [Basketball-Reference markup](https://www.basketball-reference.com/players/j/jamesle01.html) and [CSS](https://cdn.ssref.net/req/202611091/css/bbr/sr-min.css), [Transfermarkt meta description](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455).

Structured data beyond BreadcrumbList is optional and brings no rich result. Google's gallery has no sports, `SportsEvent` or `Person` feature ([search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)). `Dataset` markup only feeds Google Dataset Search, though it does accept "a table or a CSV file with some data" ([Dataset docs](https://developers.google.com/search/docs/appearance/structured-data/dataset)). `Person`/`SportsEvent` JSON-LD, as on Basketball-Reference, may help entity understanding, but that benefit is unverified. Whether Google's Event rich result applies to past competitions was not checked (unverified).

## Rejected patterns

| Pattern | Seen at | Why rejected |
|---|---|---|
| Client-rendered results tables (Vue/jQuery from JSON) | [FIG event results](https://www.gymnastics.sport/site/events/results.php?idEvent=18178), [Tennis Abstract](https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner) | The numbers are not in the HTML, which breaks #185's SEO rule. The same data can be rendered at build time instead |
| JS-only charts (web components, canvas) | [Transfermarkt](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455) | Not crawlable; adds a chart library. Use CSS bars plus a table |
| PDF-only results | [European Gymnastics](https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results), [FGI](https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html) | Poor on mobile, no internal links, weak SEO. PDFs are a data *source* for #187, not a presentation |
| Head-to-head / compare-any-two tools | [Olympedia](https://www.olympedia.org/countries/head_to_head), [Transfermarkt `tm-player-compare`](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455) | Needs a server or a large client-side dataset. Pre-built rivalry pages for a few curated pairs could be a later static substitute |
| Faceted search with many filters (year × discipline × phase × region) | [FGI](https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html), [FIG search](https://www.gymnastics.sport/site/events/searchresults.php) | Request-time querying. The static alternative is pre-generated pages per facet (`/statistiche/{anno}/{attrezzo}`) |
| Live scores / live blogs | [Gymternet meet hubs](https://thegymter.net/2025-italian-championships/) *(WebFetch summary)* | Needs live data; we rebuild nightly or on "Pubblica" |
| Dozens of tables per page; tables hidden in HTML comments | [Basketball-Reference](https://www.basketball-reference.com/players/j/jamesle01.html) | Too much for a tiny team to maintain; the comment trick exists to work around page weight we won't have |
| `FAQPage` JSON-LD for stats Q&A | [Basketball-Reference](https://www.basketball-reference.com/players/j/jamesle01.html) | Since Aug 2023 FAQ rich results are limited to government and health sites ([Google](https://developers.google.com/search/blog/2023/08/howto-faq-changes)) |
| `ProfilePage` markup on athlete pages | — | Google requires the person to be "affiliated with the overall website" ([ProfilePage docs](https://developers.google.com/search/docs/appearance/structured-data/profile-page), WebFetch summary) |
| Disabling zoom; fixed-pixel charts; no viewport meta | [Transfermarkt](https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455), [StatsF1](https://www.statsf1.com/en/lewis-hamilton.aspx), [Olympedia](https://www.olympedia.org/athletes/132107) | Mobile and accessibility anti-patterns; the site already runs an axe spec in CI |
| Numeric or query-string URLs | [FIG](https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187), [Olympedia](https://www.olympedia.org/athletes/132107) | We already use Italian slugs (`/articoli/`, `/argomenti/`); stay consistent (`/statistiche/atleti/{slug}`) |

## Sources

Gymnastics:
- FIG athlete profile: https://www.gymnastics.sport/site/athletes/bio_detail.php?id=32187
- FIG results search: https://www.gymnastics.sport/site/events/searchresults.php
- FIG event results: https://www.gymnastics.sport/site/events/results.php?idEvent=18178
- Olympedia athlete: https://www.olympedia.org/athletes/132107
- Olympedia event: https://www.olympedia.org/results/2012287
- Olympedia head-to-head: https://www.olympedia.org/countries/head_to_head
- Olympedia robots.txt: https://www.olympedia.org/robots.txt
- The Gymternet homepage: https://thegymter.net/
- The Gymternet athlete: https://thegymter.net/alice-damato/
- The Gymternet best scores: https://thegymter.net/2023/03/14/the-best-scores-in-2023-march-update/
- The Gymternet meet hub: https://thegymter.net/2025-italian-championships/
- European Gymnastics events: https://www.europeangymnastics.com/events
- European Gymnastics Leipzig 2025 results: https://www.europeangymnastics.com/event/2025-mens-and-womens-artistic-europeans-leipzig-ger/results
- FGI homepage: https://www.federginnastica.it/
- FGI Classifiche: https://www.federginnastica.it/calendario-gare/classifiche/classifiche.html
- it.wikipedia athlete: https://it.wikipedia.org/wiki/Alice_D%27Amato
- it.wikipedia event: https://it.wikipedia.org/wiki/Ginnastica_ai_Giochi_della_XXXIII_Olimpiade_-_Trave

Other sports:
- Basketball-Reference player: https://www.basketball-reference.com/players/j/jamesle01.html
- Basketball-Reference season: https://www.basketball-reference.com/leagues/NBA_2024.html
- Sports-Reference stylesheet: https://cdn.ssref.net/req/202611091/css/bbr/sr-min.css
- StatsF1 driver: https://www.statsf1.com/en/lewis-hamilton.aspx
- Tennis Abstract player: https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner
- Transfermarkt player: https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455
- Not accessible: https://fbref.com/en/players/e342ad68/Mohamed-Salah, https://www.olympics.com/en/athletes/simone-biles, https://www.procyclingstats.com/rider/tadej-pogacar

SEO references:
- Google structured data search gallery: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Google Dataset structured data: https://developers.google.com/search/docs/appearance/structured-data/dataset
- Google ProfilePage structured data: https://developers.google.com/search/docs/appearance/structured-data/profile-page
- Google FAQ/HowTo rich result changes (Aug 2023): https://developers.google.com/search/blog/2023/08/howto-faq-changes
