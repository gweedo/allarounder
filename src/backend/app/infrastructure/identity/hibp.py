"""HaveIBeenPwned k-anonymity checker — only sends the first 5 SHA-1 hex chars."""

import hashlib

import httpx


class HibpBreachedPasswordChecker:
    _API = "https://api.pwnedpasswords.com/range/{prefix}"

    def is_breached(self, password: str) -> bool:
        digest = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        try:
            response = httpx.get(
                self._API.format(prefix=prefix),
                headers={"Add-Padding": "true"},
                timeout=3.0,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            # Fail open: if HIBP is unreachable, don't block the operation.
            return False
        return any(
            line.split(":")[0] == suffix
            for line in response.text.splitlines()
        )
