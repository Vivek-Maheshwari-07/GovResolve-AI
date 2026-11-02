"""Basic hardening for the API (Part 1): response headers, an optional admin token, and a per-client rate limit on questions.

- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`.
- `GOV_ADMIN_TOKEN` (empty = off, as in local development): when set, `/admin/*` and every write to `/documents` need the header `X-Admin-Token`.
  These calls change the graph and rebuild data; a public demo should set the token.
- `GOV_QUERY_RATE_PER_MIN` (default 120, 0 = off): questions (`POST /query`, `POST /ask`) per client address per minute. Each question can cost a model call.
"""
from __future__ import annotations

import hmac
import os
import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_QUESTION_PATHS = {"/query", "/ask"}


def _is_admin_call(request: Request) -> bool:
    path, method = request.url.path, request.method
    return path.startswith("/admin") or (path.startswith("/documents") and method in ("POST", "PUT", "PATCH", "DELETE"))


class HardeningMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, admin_token: str | None = None, rate_per_min: int | None = None):
        super().__init__(app)
        self.admin_token = os.environ.get("GOV_ADMIN_TOKEN", "") if admin_token is None else admin_token
        self.rate = int(os.environ.get("GOV_QUERY_RATE_PER_MIN", "120")) if rate_per_min is None else rate_per_min
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _too_many(self, client: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[client]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.rate:
                return True
            q.append(now)
            return False

    async def dispatch(self, request: Request, call_next):
        if self.admin_token and _is_admin_call(request):
            given = request.headers.get("x-admin-token", "")
            if not hmac.compare_digest(given.encode(), self.admin_token.encode()):
                msg = "Admin token required"
                return JSONResponse({"error": msg, "reason": msg}, status_code=401)
        if self.rate > 0 and request.method == "POST" and request.url.path in _QUESTION_PATHS:
            client = request.client.host if request.client else "unknown"
            if self._too_many(client):
                msg = "Too many questions; wait a minute and try again"
                return JSONResponse({"error": msg, "reason": msg}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
