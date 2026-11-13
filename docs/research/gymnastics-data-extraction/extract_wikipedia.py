"""SPIKE (#188), throwaway: extract one competition from English Wikipedia.

Pulls the rendered HTML of a Wikipedia championship article via the MediaWiki
Action API, parses the results tables with BeautifulSoup, validates every row,
and writes JSON in the shape of the #189 prototype contract
(src/frontend/app/statistiche/_prototype/data.ts on branch prototype-stats-page).

Exit codes: 0 = written, 1 = validation failed (nothing written), 2 = fetch failed.
A broken source must fail the job, never publish empty or partial stats.

Usage (from the repo root, with the pipeline venv):
    src/pipeline/.venv/bin/python docs/research/gymnastics-data-extraction/extract_wikipedia.py \
        --out docs/research/gymnastics-data-extraction/sample-worlds-2026.json
    # offline re-run against a saved API response:
    ... --from-file /path/to/parse-response.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

API = "https://en.wikipedia.org/w/api.php"
# Generic client name on purpose (see README, "User-Agent"). A production job
# needs a descriptive UA with a contact address chosen by the project owner.
USER_AGENT = "gym-results-research-spike/0.1 (python-requests)"

# Competition metadata is not reliably in the tables; in production it would
# come from the editorial Sheet (one row per competition), not be scraped.
COMPETITION = {
    "page": "2026_World_Artistic_Gymnastics_Championships",
    "slug": "mondiali-2026-rotterdam",
    "name": "Campionati mondiali di ginnastica artistica 2026",
    "level": "internazionale",
    "tier": "Mondiali",
    "city": "Rotterdam",
    "country": "NED",
    "startDate": "2026-10-17",
    "endDate": "2026-10-25",
}

# Wikipedia gives a flag link to the country article, never an IOC code.
NATION_CODE = {
    "Algeria": "ALG", "Argentina": "ARG", "Armenia": "ARM", "Australia": "AUS",
    "Austria": "AUT", "Azerbaijan": "AZE", "Belarus": "BLR", "Belgium": "BEL",
    "Brazil": "BRA", "Bulgaria": "BUL", "Canada": "CAN", "Chile": "CHI",
    "China": "CHN", "Chinese Taipei": "TPE", "Taiwan": "TPE", "Colombia": "COL",
    "Croatia": "CRO", "Cyprus": "CYP", "Czech Republic": "CZE", "Denmark": "DEN",
    "Egypt": "EGY", "Finland": "FIN", "France": "FRA", "Germany": "GER",
    "Great Britain": "GBR", "United Kingdom": "GBR", "Greece": "GRE",
    "Hong Kong": "HKG", "Hungary": "HUN", "Iceland": "ISL", "India": "IND",
    "Iran": "IRI", "Ireland": "IRL", "Republic of Ireland": "IRL", "Israel": "ISR", "Italy": "ITA",
    "Japan": "JPN", "Kazakhstan": "KAZ", "Lithuania": "LTU", "Malaysia": "MAS",
    "Mexico": "MEX", "Mongolia": "MGL", "Netherlands": "NED",
    "Kingdom of the Netherlands": "NED", "New Zealand": "NZL", "Norway": "NOR",
    "Panama": "PAN", "Philippines": "PHI", "Poland": "POL", "Portugal": "POR",
    "Romania": "ROU", "Russia": "RUS", "Slovakia": "SVK", "Slovenia": "SLO",
    "South Africa": "RSA", "South Korea": "KOR", "Spain": "ESP", "Sweden": "SWE",
    "Switzerland": "SUI", "Turkey": "TUR", "Ukraine": "UKR",
    "United States": "USA", "Uzbekistan": "UZB", "Vietnam": "VIE",
    "Venezuela": "VEN", "Ecuador": "ECU", "Peru": "PER", "Cuba": "CUB",
    "Georgia (country)": "GEO", "Latvia": "LAT", "Estonia": "EST",
    "Luxembourg": "LUX", "Moldova": "MDA", "Serbia": "SRB", "Montenegro": "MNE",
    "Bosnia and Herzegovina": "BIH", "North Macedonia": "MKD", "Albania": "ALB",
    "Morocco": "MAR", "Tunisia": "TUN", "Nigeria": "NGR", "Singapore": "SGP",
    "Thailand": "THA", "Indonesia": "INA", "Sri Lanka": "SRI", "Jordan": "JOR",
    "Saudi Arabia": "KSA", "Qatar": "QAT", "Kuwait": "KUW",
    "Dominican Republic": "DOM", "Puerto Rico": "PUR", "Guatemala": "GUA",
    "Costa Rica": "CRC", "Jamaica": "JAM", "Trinidad and Tobago": "TTO",
    "Uruguay": "URU", "Paraguay": "PAR", "Bolivia": "BOL", "Kyrgyzstan": "KGZ",
    "Tajikistan": "TJK", "Turkmenistan": "TKM", "Pakistan": "PAK",
    "Bangladesh": "BAN", "North Korea": "PRK", "Macau": "MAC", "Malta": "MLT",
    "Monaco": "MON", "Liechtenstein": "LIE", "Andorra": "AND",
    "San Marino": "SMR", "Kosovo": "KOS", "Lebanon": "LBN", "Syria": "SYR",
    "Iraq": "IRQ", "United Arab Emirates": "UAE", "Bahrain": "BRN",
    "Oman": "OMA", "Kenya": "KEN", "Ghana": "GHA", "Mauritius": "MRI",
    "Madagascar": "MAD", "Angola": "ANG", "Senegal": "SEN",
    "Ivory Coast": "CIV", "Cameroon": "CMR", "Barbados": "BAR",
    "Bahamas": "BAH", "Bermuda": "BER", "Cayman Islands": "CAY",
    "Aruba": "ARU", "Honduras": "HON", "El Salvador": "ESA", "Nicaragua": "NCA",
}

# Apparatus icon link titles in the AA/team table headers.
APPARATUS_BY_LINK = {
    "Floor (gymnastics)": "FX", "Pommel horse": "PH", "Rings (gymnastics)": "SR",
    "Vault (gymnastics)": "VT", "Parallel bars": "PB", "Horizontal bar": "HB",
    "Uneven bars": "UB", "Balance beam": "BB",
}
APPARATUS_BY_SECTION = {
    "Floor exercise": "FX", "Pommel horse": "PH", "Rings": "SR", "Vault": "VT",
    "Parallel bars": "PB", "Horizontal bar": "HB", "Uneven bars": "UB",
    "Balance beam": "BB", "Individual all-around": "AA", "Team": "TEAM",
}
APPARATUS_ORDER = {"MAG": ["FX", "PH", "SR", "VT", "PB", "HB"], "WAG": ["VT", "UB", "BB", "FX"]}
# Minimum rows per phase: anything shorter means the table changed or vanished.
MIN_ROWS = {("finale", "TEAM"): 8, ("finale-aa", "AA"): 24, ("finale", "*"): 8,
            ("qualifica", "*"): 8, ("qualifica", "AA"): 24, ("qualifica", "TEAM"): 8}
REQUESTS = {"n": 0}  # requests actually sent, reported at the end
TOL = 0.0011  # FIG truncates to 3 decimals; allow one unit of rounding drift


class ValidationError(Exception):
    pass


def slugify(text: str) -> str:
    """Same algorithm as Slug.from_title in src/pipeline/domain."""
    ascii_only = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")


def num(text: str) -> float | None:
    text = text.strip().replace("−", "-")  # Unicode minus
    if re.fullmatch(r"-?\d+,\d{3}", text):  # stray European decimal comma
        text = text.replace(",", ".")
    if not text or text in {"—", "–", "-"}:
        return None
    m = re.fullmatch(r"-?\d+(\.\d+)?", text)
    if not m:
        raise ValidationError(f"not a number: {text!r}")
    return float(text)


def penalty(text: str) -> float:
    v = num(text)
    return abs(v) if v else 0.0  # Wikipedia writes deductions as "-0.1" or "0.1"


@dataclass
class Ctx:
    athletes: dict[str, dict] = field(default_factory=dict)  # slug -> athlete
    by_wiki: dict[str, str] = field(default_factory=dict)     # wiki title -> slug
    canonical: dict[str, str] = field(default_factory=dict)   # redirect title -> article title
    errors: list[str] = field(default_factory=list)        # shape: always fatal
    issues: list[str] = field(default_factory=list)        # arithmetic: fatal unless --mark-inconsistent
    mark: bool = False

    def inconsistent(self, row: dict, msg: str) -> None:
        """The source contradicts itself (e.g. parts don't add up to the total)."""
        self.issues.append(msg)
        if self.mark:
            row.setdefault("inconsistent", []).append(msg.split(": ", 1)[-1])


def nation_of(cell: Tag, where: str, ctx: Ctx) -> str:
    flag = cell.find(class_="flagicon")
    link = flag.find("a") if flag else None
    if link is None and flag is not None:  # team rows: unlinked flag + country link
        link = next((a for a in cell.find_all("a") if not a.find_parent(class_="flagicon")), None)
    title = link.get("title") if link else None
    if not title or title not in NATION_CODE:
        ctx.errors.append(f"{where}: unknown nation {title!r}")
        return "???"
    return NATION_CODE[title]


def athlete_of(cell: Tag, discipline: str, where: str, ctx: Ctx) -> str:
    nation = nation_of(cell, where, ctx)
    links = [a for a in cell.find_all("a") if not a.find_parent(class_="flagicon")]
    name = (links[-1].get_text(strip=True) if links else cell.get_text(" ", strip=True))
    name = re.sub(r"\s*\[.*?\]\s*", "", name).strip()
    wiki = links[-1].get("title") if links and "redlink" not in links[-1].get("href", "") else None
    wiki = ctx.canonical.get(wiki, wiki)  # "Frederick Richard" -> "Fred Richard"
    # Identity: prefer the Wikipedia article (stable across spellings like
    # Sergey/Sergei Naidin); fall back to the display name.
    if wiki and wiki in ctx.by_wiki:
        return ctx.by_wiki[wiki]
    slug = slugify(wiki.split(" (")[0] if wiki else name)
    if slug in ctx.athletes and ctx.athletes[slug]["nation"] != nation:
        slug = f"{slug}-{nation.lower()}"
    ctx.athletes.setdefault(slug, {"slug": slug, "name": name, "nation": nation,
                                   "discipline": discipline, **({"wiki": wiki} if wiki else {})})
    if wiki:
        ctx.by_wiki[wiki] = slug
    return slug


def rank_of(cell: Tag) -> int | None:
    sort = cell.find(attrs={"data-sort-value": True})
    if sort:
        m = re.match(r"0*(\d+)", sort["data-sort-value"])
        if m:
            return int(m.group(1))
    m = re.search(r"\d+", cell.get_text(" ", strip=True))
    return int(m.group()) if m else None


def body_rows(table: Tag) -> list[list[Tag]]:
    """Data rows as full cell grids: rowspan'd cells are repeated into the rows
    they cover. Ties share rank and scores via rowspan; team tables span the
    rank and total over the member rows."""
    rows: list[list[Tag]] = []
    pending: dict[int, list] = {}  # column -> [cell, rows remaining]
    for tr in table.find_all("tr"):
        own = tr.find_all(["td", "th"], recursive=False)
        if not own or all(c.name == "th" for c in own):
            continue
        grid, col, it = [], 0, iter(own)
        while True:
            if col in pending:
                cell = pending[col][0]
                grid.append(cell)
                pending[col][1] -= 1
                if pending[col][1] == 0:
                    del pending[col]
                col += 1
                continue
            cell = next(it, None)
            if cell is None:
                break
            span = int(cell.get("rowspan", 1) or 1)
            if span > 1:
                pending[col] = [cell, span - 1]
            grid.append(cell)
            col += 1
        rows.append(grid)
    return rows


def is_reserve(cells: list[Tag]) -> bool:
    tr = cells[1].find_parent("tr")  # the name cell is never rowspan'd
    return "#cccc99" in (tr.get("style") or "").lower()


def check_routine(r: dict, where: str, ctx: Ctx) -> None:
    calc = r["d"] + r["e"] + r.get("bonus", 0) - r["penalty"]
    if abs(calc - r["total"]) > TOL:
        ctx.inconsistent(r, f"{where}: D+E+bon-pen={calc:.3f} != total {r['total']:.3f}")


def parse_apparatus(table, discipline, rnd, apparatus, where, ctx) -> list[dict]:
    head = [th.get_text(" ", strip=True) for th in table.find("tr").find_all("th")]
    has_bon = "Bon." in head
    out = []
    for cells in body_rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        r = {"athlete": athlete_of(cells[1], discipline, where, ctx), "rank": rank_of(cells[0]),
             "d": num(t[2]), "e": num(t[3]), "penalty": penalty(t[4])}
        i = 5
        if has_bon:
            if (b := num(t[5])):
                r["bonus"] = b
            i = 6
        r["total"] = num(t[i])
        if rnd == "qualifica":
            r["qualified"] = t[i + 1] if len(t) > i + 1 else ""
            if is_reserve(cells):
                r["reserve"] = True
        check_routine(r, f"{where} {r['athlete']}", ctx)
        out.append(r)
    return out


def parse_vault(table, discipline, rnd, where, ctx) -> list[dict]:
    head = [th.get_text(" ", strip=True) for th in table.find("tr").find_all("th")]
    per_vault_bonus = discipline == "MAG"  # men: Bon. per vault; women: one Bonus column
    width = 5 if per_vault_bonus else 4
    out = []
    for cells in body_rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        vaults = []
        for k in range(2):
            base = 2 + k * width
            v = {"d": num(t[base]), "e": num(t[base + 1]), "penalty": penalty(t[base + 2])}
            if per_vault_bonus and (b := num(t[base + 3])):
                v["bonus"] = b
            v["total"] = num(t[base + width - 1])
            check_routine(v, f"{where} vault {k + 1} row {t[1]}", ctx)
            vaults.append(v)
        i = 2 + 2 * width
        r = {"athlete": athlete_of(cells[1], discipline, where, ctx), "rank": rank_of(cells[0]),
             "vaults": vaults}
        if not per_vault_bonus and "Bonus" in head:
            if (b := num(t[i])):
                r["bonus"] = b
            i += 1
        r["total"] = num(t[i])
        avg = (vaults[0]["total"] + vaults[1]["total"]) / 2 + r.get("bonus", 0)
        if abs(avg - r["total"]) > TOL:
            ctx.inconsistent(r, f"{where} {r['athlete']}: vault avg {avg:.4f} != {r['total']}")
        if rnd == "qualifica":
            r["qualified"] = t[i + 1] if len(t) > i + 1 else ""
            if is_reserve(cells):
                r["reserve"] = True
        out.append(r)
    return out


def header_apparatus(table: Tag, discipline: str, where: str, ctx: Ctx) -> list[str]:
    found = [APPARATUS_BY_LINK.get(a.get("title")) for a in table.find("tr").find_all("a")]
    found = [x for x in found if x]
    if found != APPARATUS_ORDER[discipline]:
        ctx.errors.append(f"{where}: apparatus header {found} != {APPARATUS_ORDER[discipline]}")
    return found


def parse_aa(table, discipline, rnd, where, ctx) -> list[dict]:
    order = header_apparatus(table, discipline, where, ctx)
    out = []
    for cells in body_rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        parts = {a: num(t[2 + k]) for k, a in enumerate(order)}
        r = {"athlete": athlete_of(cells[1], discipline, where, ctx), "rank": rank_of(cells[0]),
             "total": num(t[2 + len(order)]), "parts": parts}
        if abs(sum(v or 0 for v in parts.values()) - r["total"]) > TOL * len(order):
            ctx.inconsistent(r, f"{where} {r['athlete']}: AA parts sum != total {r['total']}")
        if rnd == "qualifica":
            r["qualified"] = t[3 + len(order)] if len(t) > 3 + len(order) else ""
            if is_reserve(cells):
                r["reserve"] = True
        out.append(r)
    return out


def parse_team(table, discipline, rnd, where, ctx) -> list[dict]:
    """Team row (rank, flag+nation, per-apparatus 'score (rank)', total), then
    member rows (rank and total cells come from the team row's rowspan)."""
    order = header_apparatus(table, discipline, where, ctx)
    out: list[dict] = []
    for cells in body_rows(table):
        t = [c.get_text(" ", strip=True) for c in cells]
        if cells[1].find(class_="flagicon"):  # team row
            # "41.299 (4)" = score (apparatus rank); one cell reads "50.065 16)"
            parts = {a: num(m.group() if (m := re.match(r"[\d.,]+", t[2 + k])) else t[2 + k])
                     for k, a in enumerate(order)}
            team = {"nation": nation_of(cells[1], where, ctx), "rank": rank_of(cells[0]),
                    "total": num(t[2 + len(order)]), "parts": parts, "members": []}
            if rnd == "qualifica":
                team["qualified"] = t[3 + len(order)] if len(t) > 3 + len(order) else ""
            if abs(sum(v or 0 for v in parts.values()) - team["total"]) > TOL * len(order):
                ctx.inconsistent(team, f"{where} {team['nation']}: team parts sum != total")
            out.append(team)
        elif out:  # member row
            links = [a for a in cells[1].find_all("a")]
            wiki = links[-1].get("title") if links and "redlink" not in links[-1].get("href", "") else None
            wiki = ctx.canonical.get(wiki, wiki)
            name = cells[1].get_text(" ", strip=True)
            slug = ctx.by_wiki.get(wiki) if wiki else None
            if not slug:
                slug = slugify(wiki.split(" (")[0] if wiki else name)
                ctx.athletes.setdefault(slug, {"slug": slug, "name": name,
                                               "nation": out[-1]["nation"], "discipline": discipline,
                                               **({"wiki": wiki} if wiki else {})})
                if wiki:
                    ctx.by_wiki[wiki] = slug
            parts = {a: v for k, a in enumerate(order) if (v := num(t[2 + k])) is not None}
            out[-1]["members"].append({"athlete": slug, "parts": parts})
    for team in out:  # each apparatus counts the best 3 of 4 (or 3 of 3) members
        for a in order:
            scores = sorted((m["parts"][a] for m in team["members"] if a in m["parts"]), reverse=True)
            if team["parts"].get(a) is not None and abs(sum(scores[:3]) - team["parts"][a]) > TOL * 3:
                ctx.inconsistent(team, f"{where} {team['nation']}: {a} top-3 members "
                                       f"{sum(scores[:3]):.3f} != {team['parts'][a]}")
    return out


def sections_and_tables(soup: BeautifulSoup):
    path: list[str] = []
    for el in soup.find_all(["h2", "h3", "h4", "table"]):
        if el.name != "table":
            level = int(el.name[1])
            path = path[: level - 2] + [el.get_text(strip=True)]
        elif "wikitable" in (el.get("class") or []):
            yield list(path), el


def classify(path: list[str]):
    """Section path -> (round, discipline, apparatus) or None to skip."""
    if len(path) == 2 and path[0] in ("Men's results", "Women's results"):
        disc = "MAG" if path[0].startswith("Men") else "WAG"
        app = APPARATUS_BY_SECTION.get(path[1])
        rnd = "finale-aa" if app == "AA" else "finale"
        return (rnd, disc, app) if app else None
    if len(path) == 3 and path[0] == "Qualification" and path[1] in ("Men", "Women"):
        disc = "MAG" if path[1] == "Men" else "WAG"
        app = APPARATUS_BY_SECTION.get(path[2])
        return ("qualifica", disc, app) if app else None
    return None


def extract(html: str, ctx: Ctx) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    phases = []
    for path, table in sections_and_tables(soup):
        kind = classify(path)
        if not kind:
            continue
        rnd, disc, app = kind
        where = f"{rnd}/{disc}/{app}"
        try:
            if app == "TEAM":
                results = parse_team(table, disc, rnd, where, ctx)
            elif app == "AA":
                results = parse_aa(table, disc, rnd, where, ctx)
            elif app == "VT":
                results = parse_vault(table, disc, rnd, where, ctx)
            else:
                results = parse_apparatus(table, disc, rnd, app, where, ctx)
        except (ValidationError, IndexError) as exc:
            ctx.errors.append(f"{where}: table shape changed ({exc!r})")
            continue
        minimum = MIN_ROWS.get((rnd, app), MIN_ROWS.get((rnd, "*"), 1))
        if len(results) < minimum:
            ctx.errors.append(f"{where}: {len(results)} rows, expected >= {minimum}")
        if any(r.get("rank") is None for r in results):
            ctx.errors.append(f"{where}: row without rank")
        phases.append({"round": rnd, "discipline": disc, "apparatus": app, "results": results})
    return phases


def assert_known_values(phases: list[dict], ctx: Ctx) -> None:
    """Canary from the #187 survey (cross-checked vs World Gymnastics + Longines)."""
    fx = next((p for p in phases if (p["round"], p["discipline"], p["apparatus"]) == ("finale", "MAG", "FX")), None)
    top = fx and next((r for r in fx["results"] if r["rank"] == 1), None)
    want = {"athlete": "fred-richard", "d": 5.7, "e": 8.833, "bonus": 0.1, "total": 14.633}
    if not top or any(top.get(k) != v for k, v in want.items()):
        ctx.errors.append(f"canary: MAG FX final winner {top} != {want}")
    expected = {("finale", "MAG"): 7, ("finale", "WAG"): 5,  ("finale-aa", "MAG"): 1,
                ("finale-aa", "WAG"): 1, ("qualifica", "MAG"): 8, ("qualifica", "WAG"): 6}
    for (rnd, disc), n in expected.items():
        got = sum(1 for p in phases if p["round"] == rnd and p["discipline"] == disc)
        if got != n:
            ctx.errors.append(f"expected {n} {rnd} phases for {disc}, got {got}")


def fetch(page: str) -> dict:
    params = {"action": "parse", "page": page, "prop": "text|revid", "format": "json",
              "formatversion": "2", "maxlag": "5"}
    for attempt in range(3):
        REQUESTS["n"] += 1
        resp = requests.get(API, params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
        if resp.status_code in (429, 503) or "maxlag" in resp.text[:200]:
            time.sleep(int(resp.headers.get("Retry-After", 5)) * (attempt + 1))
            continue
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(data["error"])
        return data["parse"]
    raise RuntimeError("Wikipedia API kept rate-limiting")


def resolve_redirects(html: str) -> dict[str, str]:
    """Map every linked title in the results tables to its target article, so
    the same athlete linked under two names gets one slug. 50 titles/request."""
    soup = BeautifulSoup(html, "html.parser")
    titles = sorted({a["title"] for t in soup.select("table.wikitable") for a in t.find_all("a", title=True)
                     if not a.find_parent(class_="flagicon") and "redlink" not in a.get("href", "")})
    mapping: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        REQUESTS["n"] += 1
        resp = requests.get(API, params={"action": "query", "titles": "|".join(titles[i:i + 50]),
                                         "redirects": "1", "format": "json", "formatversion": "2",
                                         "maxlag": "5"},
                            headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        for r in resp.json()["query"].get("redirects", []):
            mapping[r["from"]] = r["to"]
        time.sleep(1)  # API etiquette: serial, unhurried
    return mapping


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--from-file", help="saved action=parse JSON response (offline)")
    ap.add_argument("--mark-inconsistent", action="store_true",
                    help="keep rows whose numbers don't add up, flagged 'inconsistent', instead of failing")
    args = ap.parse_args()
    started = time.monotonic()
    try:
        parsed = (json.loads(Path(args.from_file).read_text())["parse"] if args.from_file
                  else fetch(COMPETITION["page"]))
    except Exception as exc:  # noqa: BLE001 - spike: any fetch problem is fatal
        print(f"FETCH FAILED: {exc}", file=sys.stderr)
        return 2
    ctx = Ctx(mark=args.mark_inconsistent)
    if not args.from_file:  # offline runs skip redirect resolution
        try:
            ctx.canonical = resolve_redirects(parsed["text"])
        except Exception as exc:  # noqa: BLE001
            print(f"FETCH FAILED (redirects): {exc}", file=sys.stderr)
            return 2
    phases = extract(parsed["text"], ctx)
    assert_known_values(phases, ctx)
    for label, items in (("SHAPE ERRORS", ctx.errors), ("INCONSISTENT ROWS", ctx.issues)):
        if items:
            print(f"{label} ({len(items)}):", file=sys.stderr)
            for e in items[:40]:
                print("  -", e, file=sys.stderr)
    if ctx.errors or (ctx.issues and not ctx.mark):
        print("VALIDATION FAILED, nothing written.", file=sys.stderr)
        return 1
    page = COMPETITION["page"]
    revid = parsed["revid"]
    meta = {k: v for k, v in COMPETITION.items() if k != "page"}
    doc = {
        "source": {
            "name": "Wikipedia (en)",
            "title": page.replace("_", " "),
            "url": f"https://en.wikipedia.org/w/index.php?title={page}&oldid={revid}",
            "revid": revid,
            "license": "CC BY-SA 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            "attribution": "Dati tratti da Wikipedia (inglese), licenza CC BY-SA 4.0",
            "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "season": int(meta["startDate"][:4]),
        "updatedAt": datetime.now(timezone.utc).date().isoformat(),
        "athletes": sorted(ctx.athletes.values(), key=lambda a: a["slug"]),
        "competitions": [{**meta, "phases": phases}],
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    rows = sum(len(p["results"]) for p in phases)
    print(f"OK: {len(phases)} phases, {rows} result rows, {len(ctx.athletes)} athletes, "
          f"{len(ctx.issues)} flagged inconsistent, revid {revid}, {REQUESTS['n']} requests, "
          f"{time.monotonic() - started:.1f}s -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
