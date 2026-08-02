"""Reject passwords that appear in known breaches, via the Have I Been Pwned range
API. The check is k-anonymous: only the first five characters of the SHA-1 hash are
sent, never the password. If the service is unreachable the check fails open so a
network problem never blocks a signup.
"""

import hashlib
import logging

import httpx

from app.config import settings

logger = logging.getLogger("app")

_RANGE_URL = "https://api.pwnedpasswords.com/range/"


def is_breached(password: str) -> bool:
    if not settings.check_breached_passwords:
        return False
    digest = hashlib.sha1(password.encode()).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    try:
        # Add-Padding asks the API to pad the response so its size leaks nothing.
        resp = httpx.get(_RANGE_URL + prefix, headers={"Add-Padding": "true"}, timeout=5.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("breached-password check unavailable, allowing password: %s", exc)
        return False
    for line in resp.text.splitlines():
        candidate, _, count = line.partition(":")
        if candidate.strip().upper() == suffix and count.strip() not in ("", "0"):
            return True
    return False
