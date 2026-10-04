"""Structural checks on the GitHub Actions workflows the publish flow depends on.

A content PR opened by publish.yml with the default GITHUB_TOKEN does not
trigger ci.yml's `pull_request` run (GitHub suppresses workflow runs for
events caused by GITHUB_TOKEN, except `workflow_dispatch`/`repository_dispatch`).
Without CI, the "Protect main" ruleset's required checks never report and
auto-merge never fires -- so publish.yml must dispatch ci.yml explicitly.
These tests pin that wiring; nothing else exercises it short of a live run.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

WORKFLOWS = Path(__file__).resolve().parents[3] / ".github" / "workflows"


def _load(name: str) -> dict[Any, Any]:
    with open(WORKFLOWS / name, encoding="utf-8") as f:
        data: dict[Any, Any] = yaml.safe_load(f)
    return data


def _triggers(workflow: dict[Any, Any]) -> dict[str, Any]:
    # PyYAML (YAML 1.1) parses the bare key `on` as boolean True.
    triggers = workflow["on"] if "on" in workflow else workflow[True]
    assert isinstance(triggers, dict)
    return triggers


def _content_pr_step(publish: dict[Any, Any]) -> str:
    steps = publish["jobs"]["publish"]["steps"]
    [step] = [s for s in steps if "gh pr create" in s.get("run", "")]
    run: str = step["run"]
    return run


def test_ci_can_be_dispatched() -> None:
    assert "workflow_dispatch" in _triggers(_load("ci.yml"))


def test_publish_may_dispatch_workflows() -> None:
    assert _load("publish.yml")["permissions"].get("actions") == "write"


def test_content_pr_step_dispatches_ci_on_its_branch() -> None:
    run = _content_pr_step(_load("publish.yml"))
    assert 'gh workflow run ci.yml --ref "$branch"' in run


def test_content_pr_step_enables_auto_merge_before_dispatching_ci() -> None:
    # If CI finished before auto-merge was enabled, `gh pr merge --auto`
    # would behave differently (merge immediately or error).
    run = _content_pr_step(_load("publish.yml"))
    assert run.index("gh pr merge") < run.index("gh workflow run ci.yml")
    assert run.index("gh workflow run ci.yml") < run.index("python -m ingest.pr_wait")
