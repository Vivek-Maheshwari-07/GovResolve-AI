"""A real local HTTP server that imitates Ollama and Groq, so provider code is tested end to end without a network or a key."""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeLLMServer:
    def __init__(self) -> None:
        self.requests: list[dict] = []
        self._queue: list[tuple[int, dict, dict]] = []
        self.default = (200, {"choices": [{"message": {"content": "OK"}}]}, {})
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def _serve(self, method: str) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b""
                outer.requests.append({"method": method, "path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()},
                                       "json": json.loads(raw) if raw else None})
                status, body, headers = outer._queue.pop(0) if outer._queue else outer.default
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self):  # noqa: N802
                self._serve("POST")

            def do_GET(self):  # noqa: N802
                self._serve("GET")

            def log_message(self, *args):  # keep test output quiet
                pass

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def start(self) -> "FakeLLMServer":
        self.thread.start()
        return self

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()

    def reply(self, status: int = 200, body: dict | None = None, headers: dict | None = None) -> None:
        """Queue the next answer (served once, in order); with an empty queue the default 200 "OK" reply is used."""
        self._queue.append((status, body if body is not None else {"choices": [{"message": {"content": "OK"}}]}, headers or {}))

    def chat_requests(self) -> list[dict]:
        return [r for r in self.requests if r["path"].endswith("/chat/completions")]
