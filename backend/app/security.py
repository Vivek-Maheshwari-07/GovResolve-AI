"""Basic hardening for the API (Part 1): response headers, an optional admin token, and a per-client rate limit on questions.

- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`.
- `GOV_ADMIN_TOKEN`: when set, `/admin/*`, `/logs`, `/api/upload` and every write to `/documents` need the header `X-Admin-Token`.
  When it is empty (local development) those calls are accepted from this machine only (loopback); remote clients get 403.
  These calls change the graph, rebuild data or expose the query log; a shared demo must set the token.
- `GOV_QUERY_RATE_PER_MIN` (default 120, 0 = off): questions (`POST /query`, `/api/query`, `/ask`) per client address per minute. Each question can cost a model call.
- `GOV_TRUST_PROXY=1`: take the client address from the first `X-Forwarded-For` entry. Set it only behind a reverse proxy you control.
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

_QUESTION_PATHS = {"/query", "/api/query", "/ask"}
_LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}   # "testclient" is Starlette's TestClient


def _is_admin_call(request: Request) -> bool:
    path, method = request.url.path, request.method
    return path.startswith(("/admin", "/logs", "/api/upload")) or (path.startswith("/documents") and method in ("POST", "PUT", "PATCH", "DELETE"))


class HardeningMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, admin_token: str | None = None, rate_per_min: int | None = None):
        super().__init__(app)
        self.admin_token = os.environ.get("GOV_ADMIN_TOKEN", "") if admin_token is None else admin_token
        self.rate = int(os.environ.get("GOV_QUERY_RATE_PER_MIN", "120")) if rate_per_min is None else rate_per_min
        self.trust_proxy = os.environ.get("GOV_TRUST_PROXY", "0") == "1"
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _too_many(self, client: str) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 1000:   # forget clients that have been idle for a minute
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] > 60]:
                    del self._hits[k]
            q = self._hits[client]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.rate:
                return True
            q.append(now)
            return False

    def _client(self, request: Request) -> str:
        if self.trust_proxy:
            forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if forwarded:
                return forwarded
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if _is_admin_call(request):
            if self.admin_token:
                given = request.headers.get("x-admin-token", "")
                if not hmac.compare_digest(given.encode(), self.admin_token.encode()):
                    msg = "Admin token required"
                    return JSONResponse({"error": msg, "reason": msg}, status_code=401)
            elif self._client(request) not in _LOOPBACK:
                msg = "Admin calls are accepted from this machine only; set GOV_ADMIN_TOKEN to allow remote use"
                return JSONResponse({"error": msg, "reason": msg}, status_code=403)
        if self.rate > 0 and request.method == "POST" and request.url.path in _QUESTION_PATHS:
            if self._too_many(self._client(request)):
                msg = "Too many questions; wait a minute and try again"
                return JSONResponse({"error": msg, "reason": msg}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
