"""/ask orchestration: routes through engine (LazySquad2Engine/RetrievalEngine) or vector store fallback."""
import time
import uuid

from ..schemas import AnswerStatus, AskRequest, AskResponse, Citation, worst_status
from .vector_store import VectorStore

MIN_SCORE = 0.15  # below this a hit is treated as no evidence


def _engine_answer(question: str, language: str, engine, corpus) -> dict | None:
    if engine is None:
        return None
    try:
        res = engine.answer(question, language)
    except Exception:
        return None
    if not res.answer and not res.citations:
        return {
            "answer": "",
            "citations": [],
            "refusal_reason": res.insufficient_reason or "No relevant GR found in the corpus.",
            "answer_status": "Insufficient Evidence",
        }
    citations = []
    for c in res.citations:
        # Match doc_id and page to a chunk in corpus
        matched_chunk = None
        rec = corpus.get(c.doc_id)
        if rec:
            for ch in rec.chunks:
                if ch.page == c.page and (c.quote in ch.text or ch.text in c.quote):
                    matched_chunk = ch
                    break
            if matched_chunk is None:
                for ch in rec.chunks:
                    if ch.page == c.page:
                        matched_chunk = ch
                        break
        cid = matched_chunk.chunk_id if matched_chunk else f"{c.doc_id}:1"
        citations.append({
            "chunk_id": cid,
            "gr_id": c.doc_id,
            "page": c.page,
            "quote": c.quote,
            "bbox": {"x0": c.bbox[0], "y0": c.bbox[1], "x1": c.bbox[2], "y1": c.bbox[3]} if c.bbox and len(c.bbox) >= 4 else (matched_chunk.bbox.model_dump() if matched_chunk and matched_chunk.bbox else None),
            "score": 1.0,
        })
    return {
        "answer": res.answer or "",
        "citations": citations,
        "refusal_reason": res.insufficient_reason,
    }


def _fallback_answer(question: str, filters: dict | None, store: VectorStore) -> dict:
    hits = [h for h in store.search(question, k=3, filters=filters) if h["score"] >= MIN_SCORE]
    if not hits:
        return {"answer": "", "citations": [], "refusal_reason": "No relevant GR found in the corpus."}
    return {
        "answer": "Most relevant passage: " + hits[0]["text"],
        "citations": [{"chunk_id": h["chunk_id"], "gr_id": h["gr_id"], "page": h["page"],
                       "quote": h["text"], "score": h["score"]} for h in hits],
    }


def run_ask(req: AskRequest, *, store: VectorStore, lineage, corpus, db, engine=None) -> AskResponse:
    t0 = time.perf_counter()
    lang = req.lang or "en"
    raw = _engine_answer(req.question, lang, engine, corpus) if engine is not None else None
    if raw is None:
        raw = _fallback_answer(req.question, req.filters, store)

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
    if raw.get("answer_status") in (AnswerStatus.INSUFFICIENT_EVIDENCE.value, "Insufficient Evidence"):
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
