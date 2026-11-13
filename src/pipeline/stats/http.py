"""The HTTP seam every source adapter receives (issue #193). Production uses
the polite client; tests pass a fake that serves saved responses."""

from __future__ import annotations

from typing import Any, Protocol


class HttpClient(Protocol):
    def get_json(self, url: str, params: dict[str, str]) -> Any: ...
