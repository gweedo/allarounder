"""Local stats run (issue #193): `python -m stats.cli --out DIR`.

Thin wiring only: the real sources on one polite HTTP client, then
stats.run. Prints the Markdown report; exit code 0 = everything written,
1 = at least one competition rejected, 2 = competitions.yaml is invalid.
The GitHub Actions workflow (stats.yml) comes after #194.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from stats.config import ConfigError
from stats.http import PoliteHttpClient
from stats.run import run_stats
from stats.sources.wikipedia import WikipediaSource
from stats.sources.world_gymnastics import WorldGymnasticsSource
from stats.verify import Source

DEFAULT_CONFIG = Path(__file__).resolve().parent / "competitions.yaml"
# Wikimedia asks for a descriptive User-Agent with a contact; the production
# value is Guido's choice (PR #192 open point 8), set via STATS_USER_AGENT.
DEFAULT_USER_AGENT = "AllarounderStatsBot/0.1 (gymnastics statistics; python-urllib)"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--out", type=Path, required=True, help="e.g. src/frontend/content/stats")
    args = parser.parse_args(argv)

    http = PoliteHttpClient(user_agent=os.environ.get("STATS_USER_AGENT", DEFAULT_USER_AGENT))
    sources: dict[str, Source] = {"wg": WorldGymnasticsSource(http), "wikipedia": WikipediaSource(http)}
    try:
        outcome = run_stats(args.config, sources, args.out)
    except ConfigError as exc:
        print(f"competitions.yaml: {exc}", file=sys.stderr)
        return 2
    print(outcome.report)
    return 0 if outcome.ok else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
