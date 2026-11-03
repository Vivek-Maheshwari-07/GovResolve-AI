"""Tiny JSON-over-HTTP helper (standard library only) shared by the providers."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Optional


class HTTPFailure(Exception):
    """A non-2xx answer or a transport error. `status` is None for transport errors (no connection, timeout)."""

    def __init__(self, status: Optional[int], reason: str, body: str = "", retry_after: Optional[float] = None):
        super().__init__(f"{status or 'network'} {reason}")
        self.status, self.reason, self.body, self.retry_after = status, reason, body, retry_after


def _retry_after(headers) -> Optional[float]:
    value = headers.get("Retry-After") if headers is not None else None
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def request_json(url: str, payload: Optional[dict] = None, headers: Optional[dict] = None, timeout: float = 60.0) -> dict:
    """POST `payload` (or GET when it is None) and return the decoded JSON body. Raises `HTTPFailure`."""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "GovResolve-AI/1.0"}  # some hosts reject the default Python user agent
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode("utf-8", "replace")
        raise HTTPFailure(e.code, str(e.reason), body, _retry_after(e.headers)) from e
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        reason = getattr(e, "reason", None) or str(e) or type(e).__name__
        raise HTTPFailure(None, str(reason)) from e
    except ValueError as e:  # the body was not JSON
        raise HTTPFailure(200, "response was not valid JSON") from e
