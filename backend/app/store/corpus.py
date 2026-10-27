import json
from pathlib import Path

from pydantic import ValidationError

from ..schemas import Chunk, GRRecord


class Corpus:
    """All GR records loaded from JSON files. Bad files are reported, never fatal."""

    def __init__(self, grs: dict[str, GRRecord] | None = None, errors: list[dict] | None = None):
        self.grs: dict[str, GRRecord] = grs or {}
        self.errors: list[dict] = errors or []
        self._chunks: dict[str, Chunk] = {}
        self._reindex()

    def _reindex(self) -> None:
        self._chunks = {c.chunk_id: c for g in self.grs.values() for c in g.chunks}

    @classmethod
    def load(cls, directory: Path) -> "Corpus":
        grs: dict[str, GRRecord] = {}
        errors: list[dict] = []
        for path in sorted(Path(directory).glob("*.json")):
            try:
                rec = GRRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError, ValidationError) as exc:
                errors.append({"file": path.name, "error": str(exc)[:300]})
                continue
            if rec.gr_id in grs:
                errors.append({"file": path.name, "error": f"duplicate gr_id {rec.gr_id}"})
                continue
            grs[rec.gr_id] = rec
        return cls(grs, errors)

    def get(self, gr_id: str) -> GRRecord | None:
        return self.grs.get(gr_id)

    def chunk(self, chunk_id: str) -> Chunk | None:
        return self._chunks.get(chunk_id)

    def all_chunks(self) -> list[Chunk]:
        return list(self._chunks.values())

    def gr_of_chunk(self, chunk_id: str) -> str | None:
        for g in self.grs.values():
            if any(c.chunk_id == chunk_id for c in g.chunks):
                return g.gr_id
        return None
