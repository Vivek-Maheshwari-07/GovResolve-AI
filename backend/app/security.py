"""Basic hardening for the API (Part 1): response headers, an optional admin token, and a per-client rate limit on questions.

- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`.
- `GOV_ADMIN_TOKEN`: when set, `/admin/*`, `/logs`, `/api/upload` and every write to `/documents` need the header `X-Admin-Token`.
  When it is empty (local development) those calls are accepted from this machine only (loopback); remote clients get 403.
  These calls change the graph, rebuild data or expose the query log; a shared demo must set the token.
- The admin page (`GET /admin`) is public HTML; 5 wrong tokens from one address in a minute are answered 429 for the rest of that minute.
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

_QUESTION_PATHS = {"/query", "/api/query", "/query/stream", "/ask", "/translate", "/voice/transcribe", "/voice/speak", "/explain"}
_VOICE_CALL_PATHS = {"/voice/query", "/voice/webhook"}
_LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}   # "testclient" is Starlette's TestClient


def _is_admin_call(request: Request) -> bool:
    path, method = request.url.path, request.method
    if method == "GET" and path.rstrip("/") == "/admin":
        return False   # the admin PAGE (login form) is public HTML with no data; every admin API call behind it still needs the token
    return (
        path.startswith(("/admin", "/logs", "/api/upload", "/voice/calls", "/voice/monitor"))
        or (path.startswith("/documents") and method in ("POST", "PUT", "PATCH", "DELETE"))
    )


class HardeningMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, admin_token: str | None = None, rate_per_min: int | None = None, voice_token: str | None = None):
        super().__init__(app)
        self.admin_token = os.environ.get("GOV_ADMIN_TOKEN", "") if admin_token is None else admin_token
        self.voice_token = os.environ.get("GOV_VOICE_TOKEN", "") if voice_token is None else voice_token
        self.rate = int(os.environ.get("GOV_QUERY_RATE_PER_MIN", "120")) if rate_per_min is None else rate_per_min
        self.trust_proxy = os.environ.get("GOV_TRUST_PROXY", "0") == "1"
        self._hits: dict[str, deque] = defaultdict(deque)
        self._bad_tokens: dict[str, deque] = defaultdict(deque)   # wrong admin tokens per client, to slow down password guessing
        self._lock = threading.Lock()

    def _too_many_bad_tokens(self, client: str, add: bool = False) -> bool:
        """5 wrong admin tokens from one address within a minute lock that address out of admin calls for the rest of the minute."""
        now = time.monotonic()
        with self._lock:
            q = self._bad_tokens[client]
            while q and now - q[0] > 60:
                q.popleft()
            if add:
                q.append(now)
            if not q:
                self._bad_tokens.pop(client, None)
            return len(q) >= 5

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
                if self._too_many_bad_tokens(self._client(request)):
                    msg = "Too many wrong passwords; wait a minute and try again"
                    return JSONResponse({"error": msg, "reason": msg}, status_code=429, headers={"Retry-After": "60"})
                given = request.headers.get("x-admin-token", "")
                if not hmac.compare_digest(given.encode(), self.admin_token.encode()):
                    self._too_many_bad_tokens(self._client(request), add=True)
                    msg = "Admin token required"
                    return JSONResponse({"error": msg, "reason": msg}, status_code=401)
            elif self._client(request) not in _LOOPBACK:
                msg = "Admin calls are accepted from this machine only; set GOV_ADMIN_TOKEN to allow remote use"
                return JSONResponse({"error": msg, "reason": msg}, status_code=403)
        if self.voice_token and request.url.path in _VOICE_CALL_PATHS and request.method == "POST":
            auth = request.headers.get("authorization", "")
            bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
            given = request.headers.get("x-voice-token", "") or bearer
            if not hmac.compare_digest(given.encode(), self.voice_token.encode()):
                msg = "Voice token required"
                return JSONResponse({"error": msg, "reason": msg}, status_code=401)
        if self.rate > 0 and request.method == "POST" and request.url.path in _QUESTION_PATHS:
            if self._too_many(self._client(request)):
                msg = "Too many questions; wait a minute and try again"
                return JSONResponse({"error": msg, "reason": msg}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
