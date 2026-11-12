import json
from pathlib import Path

from pydantic import ValidationError

from ..schemas import Chunk, GRRecord


def from_legacy(raw: dict) -> dict:
    """Convert a record written by `backend.ingestion` (pages, chunks with `pages`/`bboxes`, `file_path`) to the corpus format.

    `data/processed` holds the ingestion format, while the API reads one chunk per page with a single `bbox` and a bare `source_pdf`.
    Records already in the corpus format are returned unchanged. A GR number of "UNKNOWN" becomes None so that unrelated documents
    never match each other on it.
    """
    chunks = raw.get("chunks") or []
    if "pages" not in raw or (chunks and "page" in chunks[0]):
        return raw
    pages = raw.get("pages") or []
    scanned = [p.get("ocr_confidence") for p in pages if isinstance(p, dict) and p.get("source_type") == "scanned"
               and p.get("ocr_confidence") is not None]
    confidence: dict[str, float] = {}
    if raw.get("metadata_confidence") is not None:
        confidence["metadata"] = float(raw["metadata_confidence"])
    if scanned:   # presence of ocr_mean_word_conf marks the record as scanned for the answer pipeline
        confidence["text"] = confidence["ocr_mean_word_conf"] = sum(scanned) / len(scanned)
    number = raw.get("gr_number")
    number = None if not number or str(number).upper() == "UNKNOWN" else number
    new_chunks = []
    for c in chunks:
        cpages = c.get("pages") or [1]
        boxes = c.get("bboxes") or []
        box = {k: boxes[0][k] for k in ("x0", "y0", "x1", "y1")} if boxes and all(k in boxes[0] for k in ("x0", "y0", "x1", "y1")) else None
        new_chunks.append({"chunk_id": c["chunk_id"], "page": cpages[0], "text": c.get("text") or c.get("text_clean") or "",
                           "clause_label": c.get("section_ref"), "section": "other", "bbox": box})
    language = raw.get("language") if raw.get("language") in ("gu", "en", "mixed") else "mixed"
    return {
        "gr_id": raw["gr_id"], "gr_number": number, "department": raw.get("department"),
        "issue_date": raw.get("issue_date"), "effective_date": raw.get("effective_date"), "subject": raw.get("subject"),
        "language": language, "source_pdf": str(raw.get("file_path") or "").replace("\\", "/").rsplit("/", 1)[-1] or None,
        "page_count": len(pages) or max((c["page"] for c in new_chunks), default=1), "chunks": new_chunks,
        "field_confidence": confidence,
    }


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
                rec = GRRecord.model_validate(from_legacy(json.loads(path.read_text(encoding="utf-8"))))
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
