from __future__ import annotations

from ingest.pr_guard import find_stalled_pr


class TestFindStalledPr:
    def test_no_open_prs_returns_none(self) -> None:
        assert find_stalled_pr([]) is None

    def test_open_pr_unrelated_to_publish_returns_none(self) -> None:
        prs = [{"number": 42, "headRefName": "feat/something", "url": "https://x/42"}]
        assert find_stalled_pr(prs) is None

    def test_open_publish_pr_is_found(self) -> None:
        prs = [
            {"number": 42, "headRefName": "feat/something", "url": "https://x/42"},
            {"number": 108, "headRefName": "content/publish-999", "url": "https://x/108"},
        ]

        stalled = find_stalled_pr(prs)

        assert stalled is not None
        assert stalled["number"] == 108

    def test_returns_first_match_when_multiple_are_open(self) -> None:
        prs = [
            {"number": 108, "headRefName": "content/publish-999", "url": "https://x/108"},
            {"number": 109, "headRefName": "content/publish-1000", "url": "https://x/109"},
        ]

        stalled = find_stalled_pr(prs)

        assert stalled is not None
        assert stalled["number"] == 108
