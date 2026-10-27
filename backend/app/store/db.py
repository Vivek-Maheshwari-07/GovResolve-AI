import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from ..schemas import LineageEdge

SCHEMA = """
CREATE TABLE IF NOT EXISTS edges (edge_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS manual_edges (
    edge_id TEXT PRIMARY KEY, action TEXT NOT NULL, data TEXT, author TEXT, note TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS query_log (
    query_id TEXT PRIMARY KEY, created_at TEXT, question TEXT, answer TEXT, answer_status TEXT,
    refusal_reason TEXT, citations TEXT, latency_ms INTEGER);
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT, query_id TEXT, verdict TEXT, note TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS llm_cache (sentence_hash TEXT PRIMARY KEY, result TEXT, created_at TEXT);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def _exec(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            cur = self._conn.execute(sql, params)
            self._conn.commit()
            return cur.fetchall()

    # detected edges (written by lineage build)
    def save_edges(self, edges: list[LineageEdge]) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM edges")
            self._conn.executemany(
                "INSERT INTO edges VALUES (?, ?)", [(e.edge_id, e.model_dump_json()) for e in edges]
            )
            self._conn.commit()

    def load_edges(self) -> list[LineageEdge]:
        return [LineageEdge.model_validate_json(r["data"]) for r in self._exec("SELECT data FROM edges")]

    # manual overrides: add / remove, newest wins
    def add_override(self, edge: LineageEdge, author: str, note: str | None) -> None:
        self._exec(
            "INSERT OR REPLACE INTO manual_edges VALUES (?, 'add', ?, ?, ?, ?)",
            (edge.edge_id, edge.model_dump_json(), author, note, _now()),
        )

    def remove_override(self, edge_id: str, author: str, note: str | None) -> None:
        self._exec(
            "INSERT OR REPLACE INTO manual_edges VALUES (?, 'remove', NULL, ?, ?, ?)",
            (edge_id, author, note, _now()),
        )

    def delete_override(self, edge_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute("DELETE FROM manual_edges WHERE edge_id = ?", (edge_id,))
            self._conn.commit()
            return cur.rowcount > 0

    def list_overrides(self) -> list[dict]:
        return [dict(r) for r in self._exec("SELECT * FROM manual_edges ORDER BY created_at")]

    def overrides(self) -> tuple[list[LineageEdge], list[str]]:
        added, removed = [], []
        for r in self.list_overrides():
            if r["action"] == "add":
                added.append(LineageEdge.model_validate_json(r["data"]).model_copy(update={"method": "manual"}))
            else:
                removed.append(r["edge_id"])
        return added, removed

    # query log + feedback
    def log_query(self, *, query_id, question, answer, answer_status, refusal_reason, citations, latency_ms) -> None:
        self._exec(
            "INSERT INTO query_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (query_id, _now(), question, answer, answer_status, refusal_reason,
             json.dumps(citations, default=str), latency_ms),
        )

    def get_log(self, query_id: str) -> dict | None:
        rows = self._exec("SELECT * FROM query_log WHERE query_id = ?", (query_id,))
        return self._log_row(rows[0]) if rows else None

    def recent_logs(self, limit: int = 20) -> list[dict]:
        rows = self._exec("SELECT * FROM query_log ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,))
        return [self._log_row(r) for r in rows]

    @staticmethod
    def _log_row(r: sqlite3.Row) -> dict:
        d = dict(r)
        d["citations"] = json.loads(d["citations"] or "[]")
        return d

    def add_feedback(self, query_id: str, verdict: str, note: str | None) -> None:
        self._exec("INSERT INTO feedback (query_id, verdict, note, created_at) VALUES (?, ?, ?, ?)",
                   (query_id, verdict, note, _now()))

    # LLM cache for Member A
    def cache_get(self, sentence_hash: str) -> dict | None:
        rows = self._exec("SELECT result FROM llm_cache WHERE sentence_hash = ?", (sentence_hash,))
        return json.loads(rows[0]["result"]) if rows else None

    def cache_put(self, sentence_hash: str, result: dict) -> None:
        self._exec("INSERT OR REPLACE INTO llm_cache VALUES (?, ?, ?)", (sentence_hash, json.dumps(result), _now()))
