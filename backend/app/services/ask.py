"""/ask orchestration: Squad 2's answer() if it exists, else retrieval-only fallback."""
import importlib
import time
import uuid

from ..schemas import AnswerStatus, AskRequest, AskResponse, Citation, CLAUSE_TO_ANSWER, worst_status
from .vector_store import VectorStore

MIN_SCORE = 0.15  # below this a hit is treated as no evidence


def _squad2_answer():
    try:
        return importlib.import_module("app.core_ai").answer
    except (ImportError, AttributeError):
        return None


def _fallback_answer(question: str, filters: dict | None, store: VectorStore) -> dict:
    hits = [h for h in store.search(question, k=3, filters=filters) if h["score"] >= MIN_SCORE]
    if not hits:
        return {"answer": "", "citations": [], "refusal_reason": "No relevant GR found in the corpus."}
    return {
        "answer": "Retrieval-only answer (Squad 2 pipeline not connected). Most relevant passage: " + hits[0]["text"],
        "citations": [{"chunk_id": h["chunk_id"], "gr_id": h["gr_id"], "page": h["page"],
                       "quote": h["text"], "score": h["score"]} for h in hits],
    }


def run_ask(req: AskRequest, *, store: VectorStore, lineage, corpus, db) -> AskResponse:
    t0 = time.perf_counter()
    fn = _squad2_answer()
    raw = fn(req.question, req.filters) if fn else _fallback_answer(req.question, req.filters, store)

    citations: list[Citation] = []
    for c in raw.get("citations", []):
        cit = Citation.model_validate(c)
        chunk = corpus.chunk(cit.chunk_id)
        if chunk is None:  # citation to a chunk we do not hold cannot be verified
            continue
        cit.gr_id = cit.gr_id or corpus.gr_of_chunk(cit.chunk_id)
        cit.page = cit.page or chunk.page
        cit.bbox = cit.bbox or (chunk.bbox.model_dump() if chunk.bbox else None)
        cit.lineage = lineage.chunk_status(cit.chunk_id)
        citations.append(cit)

    refusal = raw.get("refusal_reason")
    if not citations:
        status, refusal = AnswerStatus.INSUFFICIENT_EVIDENCE, refusal or "No verifiable citation."
    else:
        status = worst_status([c.lineage.answer_status for c in citations])
    if raw.get("answer_status") == AnswerStatus.INSUFFICIENT_EVIDENCE.value:  # Squad 2 verifier override
        status = AnswerStatus.INSUFFICIENT_EVIDENCE

    resp = AskResponse(
        query_id=uuid.uuid4().hex[:12], question=req.question, answer=raw.get("answer", ""),
        answer_status=status, refusal_reason=refusal, citations=citations,
        latency_ms=int((time.perf_counter() - t0) * 1000),
    )
    db.log_query(query_id=resp.query_id, question=resp.question, answer=resp.answer,
                 answer_status=status.value, refusal_reason=refusal,
                 citations=[c.model_dump(mode="json") for c in citations], latency_ms=resp.latency_ms)
    return resp
