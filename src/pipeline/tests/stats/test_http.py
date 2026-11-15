"""Seam 5: the polite HTTP client every source receives. A fake transport and
a fake clock: no network, no real waiting."""

from __future__ import annotations

import json
from collections.abc import Mapping

import pytest

from stats.http import PoliteHttpClient, Response
from stats.sources import SourceError

UA = "AllarounderStats/0.1 (+https://example.org/contact)"


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0
        self.slept: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(round(seconds, 3))
        self.now += seconds


class FakeTransport:
    def __init__(self, clock: FakeClock, *responses: Response | Exception) -> None:
        self.clock = clock
        self.responses = list(responses)
        self.calls: list[tuple[float, str, Mapping[str, str]]] = []

    def __call__(self, url: str, headers: Mapping[str, str]) -> Response:
        self.calls.append((self.clock.now, url, headers))
        answer = self.responses.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def ok(data: object) -> Response:
    return Response(status=200, headers={}, body=json.dumps(data).encode())


def client(*responses: Response | Exception) -> tuple[PoliteHttpClient, FakeTransport, FakeClock]:
    clock = FakeClock()
    transport = FakeTransport(clock, *responses)
    return PoliteHttpClient(user_agent=UA, transport=transport, clock=clock.time, sleep=clock.sleep), transport, clock


def test_sends_the_configured_user_agent_and_the_query_and_returns_parsed_json() -> None:
    http, transport, _ = client(ok({"data": [1]}))

    assert http.get_json("https://example.org/api", {"page": "Fred Richard", "prop": "text|revid"}) == {"data": [1]}
    [(_, url, headers)] = transport.calls
    assert url == "https://example.org/api?page=Fred+Richard&prop=text%7Crevid"
    assert headers["User-Agent"] == UA


def test_requests_are_at_least_one_second_apart() -> None:
    http, transport, clock = client(ok({}), ok({}), ok({}))

    http.get_json("https://example.org/a", {})
    clock.now += 0.25  # parsing took a while
    http.get_json("https://example.org/b", {})
    clock.now += 3  # a long pause needs no extra wait
    http.get_json("https://example.org/c", {})

    times = [t for t, _, _ in transport.calls]
    assert times[1] - times[0] == pytest.approx(1.0)
    assert times[2] - times[1] == pytest.approx(3.0)
    assert clock.slept == [0.75]


def test_honours_retry_after_then_retries() -> None:
    http, transport, clock = client(Response(status=429, headers={"Retry-After": "7"}, body=b""), ok({"ok": True}))

    assert http.get_json("https://example.org/a", {}) == {"ok": True}
    assert clock.slept == [7.0]
    assert len(transport.calls) == 2


def test_backs_off_on_server_errors_without_retry_after_and_gives_up() -> None:
    busy = Response(status=503, headers={}, body=b"")
    http, transport, clock = client(busy, busy, busy, busy)

    with pytest.raises(SourceError, match="503"):
        http.get_json("https://example.org/a", {})
    assert clock.slept == [5.0, 10.0, 20.0]
    assert len(transport.calls) == 4


def test_network_errors_are_retried_like_server_errors() -> None:
    http, _, clock = client(OSError("connection reset"), ok({"ok": True}))

    assert http.get_json("https://example.org/a", {}) == {"ok": True}
    assert clock.slept == [5.0]


@pytest.mark.parametrize(
    "response",
    [
        Response(status=404, headers={}, body=b"not found"),
        Response(status=200, headers={}, body=b"<html>maintenance</html>"),
        Response(status=429, headers={"Retry-After": "3600"}, body=b""),  # longer than we are willing to wait
    ],
)
def test_other_failures_raise_source_error_without_retrying(response: Response) -> None:
    http, transport, _ = client(response, ok({}))

    with pytest.raises(SourceError):
        http.get_json("https://example.org/a", {})
    assert len(transport.calls) == 1


def test_retry_after_is_found_whatever_its_header_case() -> None:
    http, _, clock = client(Response(status=503, headers={"retry-after": "2"}, body=b""), ok({}))

    http.get_json("https://example.org/a", {})
    assert clock.slept == [2.0]
