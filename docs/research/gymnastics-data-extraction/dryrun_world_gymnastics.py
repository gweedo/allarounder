"""SPIKE (#188), throwaway: dry run against the World Gymnastics results API.

DO NOT write the output inside the repo. World Gymnastics publishes no reuse
terms; until #191 gets a written yes, its data is not committed or published.
This script exists to measure effort and to cross-check the Wikipedia sample.

    src/pipeline/.venv/bin/python docs/research/gymnastics-data-extraction/dryrun_world_gymnastics.py \
        --event 17247 --out /path/outside/repo/wg-17247.json \
        --compare docs/research/gymnastics-data-extraction/sample-worlds-2026.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import unicodedata
from pathlib import Path

import requests

BASE = "https://www.gymnastics.sport/api/sportevents"
USER_AGENT = "gym-results-research-spike/0.1 (python-requests)"
DISCIPLINES = {2: "MAG", 3: "WAG"}  # /api/constants/officialdisciplines/
APPARATUS = {"All-Around": "AA", "Floor Exercise": "FX", "Pommel Horse": "PH", "Still Rings": "SR",
             "Vault": "VT", "Parallel Bars": "PB", "Horizontal Bar": "HB", "Uneven Bars": "UB",
             "Balance Beam": "BB", "Team": "TEAM"}
requests_made = 0


def get(path: str, **params) -> list:
    global requests_made
    time.sleep(1)  # undocumented API: be gentle, one request per second
    requests_made += 1
    resp = requests.get(f"{BASE}/{path}", params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return resp.json()["data"]


def extract(event: int) -> dict:
    ages = get(f"{event}/agecategories/")
    phases = []
    for age in ages:
        disc = DISCIPLINES.get(age["iddiscipline"])
        if not disc or "Senior" not in age["name"]:
            continue
        for cat in get(f"{event}/categories/", idDiscipline=age["iddiscipline"]):
            app = APPARATUS[cat["name"]]
            rows = get(f"{event}/results/", ageCategory=age["id"], category=cat["id"])
            for rnd, rank_k, score_k in (("qualifica", "rankqualif", "scorequalif"),
                                         ("finale-aa" if app == "AA" else "finale", "rankfinal", "scorefinal")):
                results = [{"wgId": [g["id"] for g in r["gymnasts"]],
                            "name": " ".join(f"{g['firstname']} {g['lastname']}" for g in r["gymnasts"]),
                            "nation": r["country"], "rank": r[rank_k], "total": r[score_k]}
                           for r in rows if r[score_k] is not None]
                if results:
                    phases.append({"round": rnd, "discipline": disc, "apparatus": app,
                                   "results": sorted(results, key=lambda x: x["rank"] or 999)})
    return {"event": event, "phases": phases}


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def compare(wg: dict, wiki_path: Path) -> list[str]:
    """Match rows by (phase, nation, rank) and report total mismatches."""
    wiki = json.loads(wiki_path.read_text())
    names = {a["slug"]: a["name"] for a in wiki["athletes"]}
    official = {(p["round"], p["discipline"], p["apparatus"]): p["results"] for p in wg["phases"]}
    diffs, checked = [], 0
    for p in wiki["competitions"][0]["phases"]:
        key = (p["round"], p["discipline"], p["apparatus"])
        ref = official.get(key, [])
        for r in p["results"]:
            nation = r.get("nation") or next((a["nation"] for a in wiki["athletes"] if a["slug"] == r.get("athlete")), None)
            last = fold(names.get(r.get("athlete"), "")).split()[-1:] or [""]
            cand = [o for o in ref if o["nation"] == nation and (p["apparatus"] == "TEAM" or last[0] in fold(o["name"]))]
            if not cand:
                diffs.append(f"{key} {r.get('athlete') or nation}: not in official data")
                continue
            checked += 1
            o = cand[0]
            if abs(o["total"] - r["total"]) > 0.0011 or o["rank"] != r["rank"]:
                diffs.append(f"{key} {r.get('athlete') or nation}: wiki {r['rank']}/{r['total']} "
                             f"vs official {o['rank']}/{o['total']}"
                             + (" [flagged inconsistent]" if r.get("inconsistent") else ""))
    diffs.insert(0, f"checked {checked} rows")
    return diffs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--event", type=int, default=17247)
    ap.add_argument("--out", required=True)
    ap.add_argument("--compare")
    args = ap.parse_args()
    repo = Path(__file__).resolve().parents[3]
    if Path(args.out).resolve().is_relative_to(repo):
        print("refusing to write World Gymnastics data inside the repo (#191)", file=sys.stderr)
        return 1
    started = time.monotonic()
    data = extract(args.event)
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=1))
    rows = sum(len(p["results"]) for p in data["phases"])
    print(f"OK: {len(data['phases'])} phases, {rows} rows, {requests_made} requests, "
          f"{time.monotonic() - started:.1f}s")
    if args.compare:
        for line in compare(data, Path(args.compare)):
            print("  ", line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
