"""The HTTP seam every source adapter receives (issue #193). Production uses
PoliteHttpClient; tests pass a fake that serves saved responses.

Politeness (Wikimedia and World Gymnastics alike): serial requests at least
one second apart, a User-Agent from configuration, Retry-After honoured, and
a short exponential back-off on 5xx or network errors. Any failure that
remains becomes a SourceError, which rejects the competition."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from stats.sources import SourceError


class HttpClient(Protocol):
    def get_json(self, url: str, params: dict[str, str]) -> Any: ...


@dataclass(frozen=True)
class Response:
    status: int
    headers: Mapping[str, str]
    body: bytes


Transport = Callable[[str, Mapping[str, str]], Response]


def urllib_transport(url: str, headers: Mapping[str, str]) -> Response:  # pragma: no cover - real network
    request = urllib.request.Request(url, headers=dict(headers))
    try:
        with urllib.request.urlopen(request, timeout=30) as answer:
            return Response(status=answer.status, headers=dict(answer.headers), body=answer.read())
    except urllib.error.HTTPError as exc:
        return Response(status=exc.code, headers=dict(exc.headers or {}), body=exc.read())


RETRYABLE = {429, 500, 502, 503, 504}


class PoliteHttpClient:
    def __init__(
        self,
        user_agent: str,
        transport: Transport = urllib_transport,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        min_interval: float = 1.0,
        retries: int = 3,
        first_backoff: float = 5.0,
        max_wait: float = 120.0,
    ) -> None:
        self._user_agent = user_agent
        self._transport = transport
        self._clock = clock
        self._sleep = sleep
        self._min_interval = min_interval
        self._retries = retries
        self._first_backoff = first_backoff
        self._max_wait = max_wait
        self._last: float | None = None

    def _pace(self) -> None:
        if self._last is not None:
            wait = self._last + self._min_interval - self._clock()
            if wait > 0:
                self._sleep(wait)
        self._last = self._clock()

    def _retry_after(self, response: Response | None, backoff: float) -> float:
        headers = {k.lower(): v for k, v in response.headers.items()} if response else {}
        header = headers.get("retry-after") or ""
        return float(header) if header.strip().isdigit() else backoff

    def get_json(self, url: str, params: dict[str, str]) -> Any:
        full = f"{url}?{urllib.parse.urlencode(params)}" if params else url
        backoff = self._first_backoff
        for attempt in range(self._retries + 1):
            self._pace()
            response: Response | None = None
            try:
                response = self._transport(full, {"User-Agent": self._user_agent, "Accept": "application/json"})
                problem = f"HTTP {response.status}"
            except OSError as exc:
                problem = f"network error: {exc}"
            if response is not None and response.status == 200:
                try:
                    return json.loads(response.body)
                except ValueError as exc:
                    raise SourceError(f"{url}: response is not JSON") from exc
            if response is not None and response.status not in RETRYABLE:
                raise SourceError(f"{url}: {problem}")
            wait = self._retry_after(response, backoff)
            if attempt == self._retries or wait > self._max_wait:
                break
            self._sleep(wait)
            backoff *= 2
        raise SourceError(f"{url}: {problem} after {attempt + 1} attempt(s)")
