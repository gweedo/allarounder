"""The whole run on the real 2026 Worlds data, offline: both saved sources
(fixtures/README.md) through verification and the writer. Pins what the
first live run produced on 2026-11-15, including the 10 Wikipedia rows that
contradict themselves (the #188 spike's list)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from stats.cli import DEFAULT_CONFIG
from stats.run import run_stats
from stats.sources.wikipedia import WikipediaSource
from stats.sources.world_gymnastics import WorldGymnasticsSource
from tests.stats.test_wikipedia_source import FakeWikipedia
from tests.stats.test_world_gymnastics_source import FakeWorldGymnastics

DROPPED = {
    ("finale/MAG/TEAM", "CHN"),
    ("finale-aa/MAG/AA", "Daiki Hashimoto (JPN)"),
    ("qualifica/MAG/TEAM", "USA"),
    ("qualifica/MAG/TEAM", "BEL"),
    ("qualifica/WAG/TEAM", "ITA"),
    ("qualifica/WAG/TEAM", "GER"),
    ("qualifica/WAG/TEAM", "NED"),
    ("qualifica/WAG/AA", "Naomi Visser (NED)"),
    ("qualifica/WAG/AA", "Alena Glotova (RUS)"),
    ("qualifica/WAG/AA", "Maïana Prat (FRA)"),
}
FINAL_SIZE = {"AA": 24, "TEAM": 8}


def test_the_2026_worlds_build_from_both_real_sources(tmp_path: Path) -> None:
    out = tmp_path / "stats"
    outcome = run_stats(DEFAULT_CONFIG, {"wg": WorldGymnasticsSource(FakeWorldGymnastics()),
                                         "wikipedia": WikipediaSource(FakeWikipedia())}, out)

    assert outcome.ok, outcome.report
    dropped = {tuple(line[2:].split(": ")[0].split(", ", 1)) for line in outcome.report.splitlines()
               if line.startswith("- ") and "/" in line.split(",")[0]}
    assert dropped == DROPPED

    doc = json.loads((out / "competitions" / "mondiali-2026-rotterdam.json").read_text(encoding="utf-8"))
    athletes = json.loads((out / "athletes.json").read_text(encoding="utf-8"))
    assert len(doc["phases"]) == 28
    assert sum(len(p["results"]) for p in doc["phases"]) == 1651
    for phase in doc["phases"]:
        assert all(r["verified"] and r["source"] == "wg" for r in phase["results"])
        if phase["round"] != "qualifica":
            assert len(phase["results"]) == FINAL_SIZE.get(phase["apparatus"], 8), phase["apparatus"]
            assert phase["medals"]

    wg_ids = Counter(a["wgId"] for a in athletes if "wgId" in a)
    assert [i for i, n in wg_ids.items() if n > 1] == []
    slugs = {a["slug"] for a in athletes}
    refs = {r["athlete"] for p in doc["phases"] for r in p["results"] if "athlete" in r}
    refs |= {m["athlete"] for p in doc["phases"] for r in p["results"] for m in r.get("members", [])}
    assert refs <= slugs
