from __future__ import annotations

from ingest.pr_wait import wait_for_merge


class FakeClock:
    """Advances only when `sleep` is called -- `clock()` never moves on its
    own, so a test controls exactly how many polls happen before the
    deadline is reached."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class TestWaitForMerge:
    def test_merged_on_first_check_returns_true_without_sleeping(self) -> None:
        clock = FakeClock()

        merged = wait_for_merge(
            lambda: "MERGED", timeout_seconds=60, poll_interval_seconds=5,
            sleep=clock.sleep, clock=clock.clock,
        )

        assert merged is True
        assert clock.sleeps == []

    def test_merged_after_polling_returns_true(self) -> None:
        states = iter(["OPEN", "OPEN", "MERGED"])
        clock = FakeClock()

        merged = wait_for_merge(
            lambda: next(states), timeout_seconds=60, poll_interval_seconds=5,
            sleep=clock.sleep, clock=clock.clock,
        )

        assert merged is True
        assert clock.sleeps == [5, 5]

    def test_closed_without_merging_fails_fast_without_waiting_out_timeout(self) -> None:
        states = iter(["OPEN", "CLOSED"])
        clock = FakeClock()

        merged = wait_for_merge(
            lambda: next(states), timeout_seconds=600, poll_interval_seconds=5,
            sleep=clock.sleep, clock=clock.clock,
        )

        assert merged is False
        assert clock.sleeps == [5]

    def test_timeout_with_state_always_open_returns_false(self) -> None:
        clock = FakeClock()

        merged = wait_for_merge(
            lambda: "OPEN", timeout_seconds=20, poll_interval_seconds=5,
            sleep=clock.sleep, clock=clock.clock,
        )

        assert merged is False
        # Deadline is 20s out; polls at 0, 5, 10, 15 all see OPEN and sleep
        # 5s each, landing exactly on the 20s deadline where the loop stops
        # rather than sleeping a fifth time.
        assert clock.sleeps == [5, 5, 5, 5]
