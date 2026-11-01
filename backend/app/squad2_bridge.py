"""Plug Squad 2's RAG pipeline (branch squad2: backend/rag, backend/ingestion) into our contract.

    engine = Squad2Engine(pipeline)          # pipeline = backend.rag.search_engine.RAGPipeline
    app = create_app(engine=engine)          # /query now answers through Squad 2; we add lineage and warnings

Nothing here imports Squad 2 at module load, so this file works (and is tested) before the branches are merged.
Only `to_squad2_records` needs their models and imports `backend.models` when called.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from .engine import EngineResult
from .schemas import GRRecord, RawCitation, ReasonCode, Statement, StatementLabel

_REASONS = {
    "NO_DOCUMENT": "No relevant GR found in the corpus.",
    "TOO_VAGUE": "The question is too vague to answer from the documents.",
    "MISSING_FACTS": "The answer depends on facts the question does not give.",
    "BROKEN_CHAIN": "A GR in the chain is not in the corpus.",
    "POOR_SCAN": "The relevant page could not be read reliably.",
    "OUT_OF_SCOPE": "This question is outside what the documents can answer.",
}


_LABELS = {"Established": StatementLabel.ESTABLISHED, "Inferred": StatementLabel.INFERRED,
           "Not found": StatementLabel.NOT_FOUND}


def _val(x: Any) -> str:
    """Enum or plain string -> its text value."""
    return str(getattr(x, "value", x) or "")


def _bbox(b: Any) -> list[float] | None:
    if b is None:
        return None
    return [float(b.x0), float(b.y0), float(b.x1), float(b.y1)]


def to_engine_result(resp: Any) -> EngineResult:
    """Squad 2 `QueryResponse` (duck-typed) -> our `EngineResult`.

    Refusals map to `answer=None`, with the reason code in `reason_code` and also kept in the text. Citations keep
    Squad 2's verbatim passage. Their statements keep their label and point at our citations by index.
    """
    status = _val(resp.answer_status)
    cites = [RawCitation(doc_id=c.gr_id, page=max(int(c.page), 1), quote=c.passage, bbox=_bbox(getattr(c, "bbox", None)))
             for c in (resp.citations or []) if c.passage]
    if status == "Insufficient Evidence" or not (resp.summary or "").strip():
        code = _val(resp.insufficient_reason)
        why = _REASONS.get(code, "The available documents do not support an answer.")
        extra = (resp.follow_up_question or "").strip()
        return EngineResult(insufficient_reason=f"{code}: {why}" + (f" {extra}" if extra else "") if code else why,
                            reason_code=ReasonCode(code) if code in _REASONS else None)
    return EngineResult(answer=resp.summary.strip(), citations=cites,
                        statements=_statements(getattr(resp, "statements", None) or [], cites))


def _statements(stmts: list[Any], cites: list[RawCitation]) -> list[Statement]:
    """Squad 2 statements -> ours; each statement citation is matched to a top-level citation by (doc, page, quote)."""
    index = {(c.doc_id, c.page, c.quote): i for i, c in enumerate(cites)}
    out = []
    for st in stmts:
        label = _LABELS.get(_val(st.label))
        if label is None or not (st.text or "").strip():
            continue
        refs = [index.get((c.gr_id, max(int(c.page), 1), c.passage)) for c in (st.citations or [])]
        out.append(Statement(text=st.text.strip(), label=label, citations=[i for i in refs if i is not None]))
    return out


class Squad2Engine:
    """Our `AnswerEngine` backed by Squad 2's `RAGPipeline.answer(question, filters)`."""

    def __init__(self, pipeline: Any):
        self.pipeline = pipeline

    def answer(self, question: str, language: str) -> EngineResult:
        try:
            return to_engine_result(self.pipeline.answer(question, None))
        except Exception as exc:  # their pipeline must never take /query down
            return EngineResult(insufficient_reason=f"Answer engine error: {type(exc).__name__}")


def to_squad2_records(grs: list[GRRecord], repo_root: Path | None = None) -> list[Any]:
    """Our `GRRecord` JSON (chunks with page and bbox) -> Squad 2's `backend.models.GRRecord`, ready for GRIndex.build.

    Digital/scanned type and OCR confidence are not in our record; pages are marked digital unless the converter stored
    an `ocr_mean_word_conf` (then scanned, with that confidence).
    """
    root = repo_root or Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from backend import models as m  # noqa: E402  (Squad 2's models, available once squad2 is merged)

    out = []
    for g in grs:
        ocr = g.field_confidence.get("ocr_mean_word_conf")
        stype = m.SourceType.SCANNED if ocr is not None else m.SourceType.DIGITAL
        pages: dict[int, list] = {}
        chunks = []
        for c in g.chunks:
            bb = c.bbox.model_dump() if c.bbox else {"x0": 0, "y0": 0, "x1": 0, "y1": 0}
            box = m.BoundingBox(**bb, page=c.page)
            pages.setdefault(c.page, []).append(m.TextBlock(block_id=c.chunk_id, text=c.text, text_clean=c.text,
                                                            bbox=box, ocr_confidence=ocr))
            chunks.append(m.Chunk(chunk_id=c.chunk_id, gr_id=g.gr_id, text=c.text, text_clean=c.text, pages=[c.page],
                                  bboxes=[box], chunk_type="paragraph", section_ref=c.clause_label, ocr_confidence=ocr))
        out.append(m.GRRecord(
            gr_id=g.gr_id, gr_number=g.gr_number or g.gr_id, department=g.department or "",
            issue_date=g.issue_date.isoformat() if g.issue_date else None,
            effective_date=g.effective_date.isoformat() if g.effective_date else None,
            subject=g.subject or "", language=m.Language(g.language), source_type=stype, file_path=g.source_pdf or "",
            pages=[m.PageRecord(page_number=n, source_type=stype, blocks=blocks) for n, blocks in sorted(pages.items())],
            chunks=chunks, raw_text="\n".join(c.text for c in g.chunks)))
    return out
