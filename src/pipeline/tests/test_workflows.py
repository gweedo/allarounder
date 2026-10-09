"""Structural checks on the GitHub Actions workflows the publish flow depends on.

The content PR must be attributed end to end to one human identity -- the
owner of the PUBLISH_TOKEN fine-grained PAT -- or it can never merge:

- A PR opened by `github-actions[bot]` (the default GITHUB_TOKEN) has its
  `pull_request` CI run held as `action_required` (first-time-contributor
  approval), and a CI run dispatched separately does not attach its checks
  to the PR, so the "Protect main" ruleset's required checks never report.
- The ruleset's "require extra approval for unattributed changes" makes a
  PR wait for a human approval when it was opened by an app/bot or when the
  push or commit identity differs from the PR's author.

So publish.yml checks out (and therefore pushes) with PUBLISH_TOKEN, opens
and merges the PR with it, and authors the commit as the token's owner.
Found on the first live run (2026-10-06); see docs/DECISIONS.md. These tests
pin that wiring; nothing else exercises it short of a live run.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

WORKFLOWS = Path(__file__).resolve().parents[3] / ".github" / "workflows"
PUBLISH_TOKEN = "${{ secrets.PUBLISH_TOKEN }}"


def _load(name: str) -> dict[Any, Any]:
    with open(WORKFLOWS / name, encoding="utf-8") as f:
        data: dict[Any, Any] = yaml.safe_load(f)
    return data


def _steps(publish: dict[Any, Any]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = publish["jobs"]["publish"]["steps"]
    return steps


def _content_pr_step(publish: dict[Any, Any]) -> dict[str, Any]:
    [step] = [s for s in _steps(publish) if "gh pr create" in s.get("run", "")]
    return step


def test_checkout_uses_publish_token_so_the_push_is_attributed() -> None:
    [checkout] = [
        s
        for s in _steps(_load("publish.yml"))
        if "actions/checkout" in s.get("uses", "")
    ]
    assert checkout["with"]["token"] == PUBLISH_TOKEN


def test_checkout_builds_on_the_latest_main_not_the_trigger_commit() -> None:
    # Without `ref`, checkout uses the commit current when the run was
    # *triggered*. A run queued behind another (concurrency group) then
    # regenerates content on a main that lacks the earlier run's merge --
    # seen live 2026-10-09 (#137/#138): harmless when identical, a
    # conflicting index.json and a stalled content PR otherwise.
    [checkout] = [
        s
        for s in _steps(_load("publish.yml"))
        if "actions/checkout" in s.get("uses", "")
    ]
    assert checkout["with"]["ref"] == "main"


def test_content_pr_is_opened_and_merged_with_publish_token() -> None:
    step = _content_pr_step(_load("publish.yml"))
    assert step["env"]["GH_TOKEN"] == PUBLISH_TOKEN
    assert "gh pr merge" in step["run"]


def test_commit_is_authored_as_the_token_owner() -> None:
    run = _content_pr_step(_load("publish.yml"))["run"]
    assert "gh api user" in run
    assert "users.noreply.github.com" in run
    assert run.index("gh api user") < run.index("git commit")


def test_ci_is_not_dispatched_separately() -> None:
    # A dispatched run's checks never attach to the PR; the PR's own
    # pull_request run is the one the ruleset counts.
    run = _content_pr_step(_load("publish.yml"))["run"]
    assert "gh workflow run" not in run
    assert "python -m ingest.pr_wait" in run


def test_missing_publish_token_fails_before_the_pipeline_runs() -> None:
    steps = _steps(_load("publish.yml"))
    names = [s.get("name", "") for s in steps]
    guard = next(i for i, s in enumerate(steps) if "PUBLISH_TOKEN" in s.get("run", ""))
    assert guard < names.index("Run pipeline")


def test_repo_settings_check_uses_publish_token() -> None:
    # The REST API only returns allow_auto_merge/allow_squash_merge to a
    # token with push access; the read-only GITHUB_TOKEN gets null for both,
    # which failed the check with both settings on (2026-10-07).
    [step] = [
        s
        for s in _steps(_load("publish.yml"))
        if s.get("name") == "Verify repo settings auto-merge depends on"
    ]
    assert step["env"]["GH_TOKEN"] == PUBLISH_TOKEN


def test_github_token_keeps_read_only_permissions() -> None:
    permissions = _load("publish.yml")["permissions"]
    assert permissions == {"contents": "read", "pull-requests": "read"}
