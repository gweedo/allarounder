"""Wikipedia source adapter (issue #193): one English Wikipedia championship
article → SourceResult. Parses the rendered HTML from the MediaWiki Action API.

Only fetches and parses. Arithmetic and cross-checks belong to the
verification module; anything that means "the page layout changed" raises
SourceError here.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import replace

from bs4 import BeautifulSoup, Tag

from domain.stats.model import (
    Athlete,
    Phase,
    Result,
    Routine,
    SourceResult,
    TeamMember,
    TeamResult,
)
from stats.http import HttpClient
from stats.sources import SourceError
from stats.sources.nations import NATION_BY_WIKI_TITLE

API = "https://en.wikipedia.org/w/api.php"

# Apparatus icon link titles in all-around and team table headers.
APPARATUS_BY_ICON_LINK = {
    "Floor (gymnastics)": "FX", "Pommel horse": "PH", "Rings (gymnastics)": "SR",
    "Vault (gymnastics)": "VT", "Parallel bars": "PB", "Horizontal bar": "HB",
    "Uneven bars": "UB", "Balance beam": "BB",
}
APPARATUS_ORDER = {"MAG": ["FX", "PH", "SR", "VT", "PB", "HB"], "WAG": ["VT", "UB", "BB", "FX"]}

APPARATUS_BY_SECTION = {
    "Floor exercise": "FX", "Pommel horse": "PH", "Rings": "SR", "Vault": "VT",
    "Parallel bars": "PB", "Horizontal bar": "HB", "Uneven bars": "UB",
    "Balance beam": "BB", "Individual all-around": "AA", "Team": "TEAM",
}


def _sections_and_tables(soup: BeautifulSoup) -> Iterator[tuple[list[str], Tag]]:
    path: list[str] = []
    for el in soup.find_all(["h2", "h3", "h4", "table"]):
        if el.name != "table":
            path = path[: int(el.name[1]) - 2] + [el.get_text(strip=True)]
        elif "wikitable" in (el.get("class") or []):
            yield list(path), el


def _attr(tag: Tag, name: str) -> str | None:
    """A tag attribute as a plain string (bs4 may return lists for some)."""
    value = tag.get(name)
    return value if isinstance(value, str) else None


def _header_row(table: Tag, where: str) -> Tag:
    row = table.find("tr")
    if not isinstance(row, Tag):
        raise SourceError(f"{where}: table without a header row")
    return row


def _num(text: str) -> float | None:
    """A score cell: "14.633", "", "-0.1" (Unicode minus too), or a stray
    decimal comma "52,698". Anything else means the layout changed."""
    text = text.strip().replace("\u2212", "-")
    if re.fullmatch(r"-?\d+,\d{3}", text):
        text = text.replace(",", ".")
    if not text or text in {"—", "–", "-"}:
        return None
    if not re.fullmatch(r"-?\d+(\.\d+)?", text):
        raise SourceError(f"not a score: {text!r}")
    return float(text)


def _score(text: str, where: str) -> float:
    value = _num(text)
    if value is None:
        raise SourceError(f"{where}: missing score")
    return value


def _penalty(text: str) -> float:
    value = _num(text)
    return abs(value) if value else 0.0  # written as "-0.1" or "0.1"


def _rows(table: Tag) -> list[list[Tag]]:
    """Data rows as full grids: a rowspan'd cell is repeated into every row it
    covers (ties share rank and scores this way; team tables span rank and
    total over the member rows)."""
    rows: list[list[Tag]] = []
    pending: dict[int, list] = {}  # column -> [cell, rows still covered]
    for tr in table.find_all("tr"):
        own = tr.find_all(["td", "th"], recursive=False)
        if not own or all(c.name == "th" for c in own):
            continue
        grid: list[Tag] = []
        cells = iter(own)
        col = 0
        while True:
            if col in pending:
                grid.append(pending[col][0])
                pending[col][1] -= 1
                if pending[col][1] == 0:
                    del pending[col]
                col += 1
                continue
            cell = next(cells, None)
            if cell is None:
                break
            span = int(_attr(cell, "rowspan") or 1)
            if span > 1:
                pending[col] = [cell, span - 1]
            grid.append(cell)
            col += 1
        rows.append(grid)
    return rows


def _rank(cell: Tag, where: str) -> int:
    sort = cell.find(lambda tag: tag.has_attr("data-sort-value"))  # medal icons: "01 !"
    sort_value = _attr(sort, "data-sort-value") if isinstance(sort, Tag) else None
    if sort_value and (m := re.match(r"0*(\d+)", sort_value)):
        return int(m.group(1))
    if m := re.search(r"\d+", cell.get_text(" ", strip=True)):
        return int(m.group())
    raise SourceError(f"{where}: row without a rank")


def _nation(cell: Tag, where: str) -> str:
    flag = cell.find(class_="flagicon")
    link = flag.find("a") if flag else None
    if link is None and flag is not None:  # team rows: unlinked flag, then a country link
        link = next((a for a in cell.find_all("a") if not a.find_parent(class_="flagicon")), None)
    title = _attr(link, "title") if isinstance(link, Tag) else None
    if title is None or title not in NATION_BY_WIKI_TITLE:
        raise SourceError(f"{where}: unknown nation {title!r}")
    return NATION_BY_WIKI_TITLE[title]


def _athlete_link(cell: Tag) -> Tag | None:
    links = [a for a in cell.find_all("a") if not a.find_parent(class_="flagicon")]
    return links[-1] if links else None


def _athlete(cell: Tag, nation: str) -> Athlete:
    link = _athlete_link(cell)
    name = link.get_text(strip=True) if link else cell.get_text(" ", strip=True)
    name = re.sub(r"\s*\[.*?\]\s*", "", name).strip()
    wiki = _attr(link, "title") if link is not None and "redlink" not in (_attr(link, "href") or "") else None
    return Athlete(name=name, nation=nation, wiki=wiki)


def _header(table: Tag, where: str) -> list[str]:
    return [th.get_text(" ", strip=True) for th in _header_row(table, where).find_all("th")]


def _apparatus_rows(table: Tag, where: str) -> tuple[Result, ...]:
    has_bonus = "Bon." in _header(table, where)
    out = []
    for cells in _rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        bonus = (_num(t[5]) or 0.0) if has_bonus else 0.0
        total = _score(t[6 if has_bonus else 5], where)
        routine = Routine(d=_score(t[2], where), e=_score(t[3], where), penalty=_penalty(t[4]),
                          bonus=bonus, total=total)
        out.append(Result(athlete=_athlete(cells[1], _nation(cells[1], where)),
                          rank=_rank(cells[0], where), total=total, routine=routine))
    return tuple(out)


def _vault_rows(table: Tag, where: str) -> tuple[Result, ...]:
    """Men: D, E, Pen., Bon., Score per vault. Women: D, E, Pen., Score per
    vault, then one Bonus column for the result."""
    per_vault_bonus = "Bonus" not in _header(table, where)
    width = 5 if per_vault_bonus else 4
    out = []
    for cells in _rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        vaults = []
        for k in range(2):
            base = 2 + k * width
            bonus = (_num(t[base + 3]) or 0.0) if per_vault_bonus else 0.0
            vaults.append(Routine(d=_score(t[base], where), e=_score(t[base + 1], where),
                                  penalty=_penalty(t[base + 2]), bonus=bonus,
                                  total=_score(t[base + width - 1], where)))
        i = 2 + 2 * width
        result_bonus = 0.0
        if not per_vault_bonus:
            result_bonus = _num(t[i]) or 0.0
            i += 1
        out.append(Result(athlete=_athlete(cells[1], _nation(cells[1], where)),
                          rank=_rank(cells[0], where), total=_score(t[i], where),
                          vaults=tuple(vaults), bonus=result_bonus))
    return tuple(out)


def _header_apparatus(table: Tag, discipline: str, where: str) -> list[str]:
    found = [APPARATUS_BY_ICON_LINK.get(_attr(a, "title") or "") for a in _header_row(table, where).find_all("a")]
    order = [app for app in found if app]
    if order != APPARATUS_ORDER[discipline]:
        raise SourceError(f"{where}: apparatus columns {order}, expected {APPARATUS_ORDER[discipline]}")
    return order


def _all_around_rows(table: Tag, discipline: str, where: str) -> tuple[Result, ...]:
    order = _header_apparatus(table, discipline, where)
    out = []
    for cells in _rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        parts = {app: _score(t[2 + k], where) for k, app in enumerate(order)}
        out.append(Result(athlete=_athlete(cells[1], _nation(cells[1], where)),
                          rank=_rank(cells[0], where), total=_score(t[2 + len(order)], where),
                          parts=parts))
    return tuple(out)


def _subtotal(text: str, where: str) -> float:
    """Team subtotal cells read "41.299 (4)": score, then apparatus rank. One
    real cell reads "50.065 16)", so take the leading number only."""
    m = re.match(r"[\d.,]+", text.strip())
    return _score(m.group() if m else text, where)


def _team_rows(table: Tag, discipline: str, where: str) -> tuple[TeamResult, ...]:
    order = _header_apparatus(table, discipline, where)
    teams: list[TeamResult] = []
    members: list[list[TeamMember]] = []
    for cells in _rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        if cells[1].find(class_="flagicon"):  # team row
            teams.append(TeamResult(
                nation=_nation(cells[1], where), rank=_rank(cells[0], where),
                total=_score(t[2 + len(order)], where),
                parts={app: _subtotal(t[2 + k], where) for k, app in enumerate(order)}))
            members.append([])
        elif teams:  # member row: rank and total cells come from the team row's rowspan
            parts = {app: v for k, app in enumerate(order) if (v := _num(t[2 + k])) is not None}
            members[-1].append(TeamMember(athlete=_athlete(cells[1], teams[-1].nation), parts=parts))
    return tuple(TeamResult(nation=team.nation, rank=team.rank, total=team.total, parts=team.parts,
                            members=tuple(m)) for team, m in zip(teams, members, strict=True))


def _classify(path: list[str]) -> tuple[str, str, str] | None:
    """Section path → (round, discipline, apparatus), or None for other tables."""
    if len(path) == 2 and path[0] in ("Men's results", "Women's results"):
        app = APPARATUS_BY_SECTION.get(path[1])
        disc = "MAG" if path[0].startswith("Men") else "WAG"
        return ("finale-aa" if app == "AA" else "finale", disc, app) if app else None
    if len(path) == 3 and path[0] == "Qualification" and path[1] in ("Men", "Women"):
        app = APPARATUS_BY_SECTION.get(path[2])
        return ("qualifica", "MAG" if path[1] == "Men" else "WAG", app) if app else None
    return None


def _wiki_titles(phases: list[Phase]) -> set[str]:
    titles: set[str] = set()
    for phase in phases:
        for row in phase.results:
            people = [m.athlete for m in row.members] if isinstance(row, TeamResult) else [row.athlete]
            titles.update(a.wiki for a in people if a.wiki)
    return titles


def _canonical(athlete: Athlete, redirects: dict[str, str]) -> Athlete:
    if athlete.wiki in redirects:
        return replace(athlete, wiki=redirects[athlete.wiki])
    return athlete


def _apply_redirects(phase: Phase, redirects: dict[str, str]) -> Phase:
    rows: list[Result | TeamResult] = []
    for row in phase.results:
        if isinstance(row, TeamResult):
            members = tuple(replace(m, athlete=_canonical(m.athlete, redirects)) for m in row.members)
            rows.append(replace(row, members=members))
        else:
            rows.append(replace(row, athlete=_canonical(row.athlete, redirects)))
    return replace(phase, results=tuple(rows))


class WikipediaSource:
    def __init__(self, http: HttpClient) -> None:
        self._http = http

    def fetch(self, ref: str) -> SourceResult:
        parsed = self._http.get_json(API, {"action": "parse", "page": ref, "prop": "text|revid",
                                           "format": "json", "formatversion": "2"})["parse"]
        soup = BeautifulSoup(parsed["text"], "html.parser")
        phases = []
        for path, table in _sections_and_tables(soup):
            kind = _classify(path)
            if not kind:
                continue
            rnd, disc, app = kind
            where = f"{rnd}/{disc}/{app}"
            results: tuple[Result | TeamResult, ...]
            if app == "TEAM":
                results = _team_rows(table, disc, where)
            elif app == "AA":
                results = _all_around_rows(table, disc, where)
            elif app == "VT":
                results = _vault_rows(table, where)
            else:
                results = _apparatus_rows(table, where)
            phases.append(Phase(round=rnd, discipline=disc, apparatus=app, results=results))
        redirects = self._redirects(sorted(_wiki_titles(phases)))
        phases = [_apply_redirects(p, redirects) for p in phases]
        return SourceResult(source="wikipedia", revision=str(parsed["revid"]), phases=tuple(phases))

    def _redirects(self, titles: list[str]) -> dict[str, str]:
        """The same athlete can be linked under an old article name
        ("Frederick Richard" → "Fred Richard"); resolve to the current title."""
        mapping: dict[str, str] = {}
        for i in range(0, len(titles), 50):  # API limit per query
            answer = self._http.get_json(API, {"action": "query", "titles": "|".join(titles[i:i + 50]),
                                               "redirects": "1", "format": "json", "formatversion": "2"})
            mapping.update({r["from"]: r["to"] for r in answer["query"].get("redirects", [])})
        return mapping
