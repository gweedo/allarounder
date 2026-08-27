"""Environment configuration for the pipeline entrypoint (CONTENT-CONTRACT.md §8).

Credentials and IDs come from GitHub Actions secrets at runtime -- never
hardcoded, mocked into a production path, or committed.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    service_account_json: str
    sheet_id: str
    sheet_name: str


def load_config(env: dict[str, str] | None = None) -> Config:
    source = env if env is not None else os.environ
    service_account_json = source.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    sheet_id = source.get("SHEET_ID")
    sheet_name = source.get("SHEET_NAME", "Articoli")
    if not service_account_json:
        raise ConfigError("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
    if not sheet_id:
        raise ConfigError("SHEET_ID is not set")
    return Config(service_account_json=service_account_json, sheet_id=sheet_id, sheet_name=sheet_name)
