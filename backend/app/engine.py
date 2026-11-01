"""Interface to Squad 2's retrieval + answer engine."""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

from .schemas import RawCitation, ReasonCode, Statement


class EngineResult(BaseModel):
    answer: str | None = None
    citations: list[RawCitation] = Field(default_factory=list)
    insufficient_reason: str | None = None
    reason_code: ReasonCode | None = None
    statements: list[Statement] = Field(default_factory=list)  # citation indexes point into `citations`


class AnswerEngine(Protocol):
    def answer(self, question: str, language: str) -> EngineResult: ...


class NullEngine:
    """Placeholder until Squad 2's engine is wired in; always refuses."""

    def answer(self, question: str, language: str) -> EngineResult:
        return EngineResult(insufficient_reason="No answer engine is connected yet.")


class RetrievalEngine:
    """Default `/query` engine: Squad 2's `core_ai.answer` if present, else top vector hits.

    Citations carry the chunk text verbatim so the quote check on our side always holds.
    """

    MIN_SCORE = 0.15

    def __init__(self, get_state):
        self._get_state = get_state

    def answer(self, question: str, language: str) -> EngineResult:
        state = self._get_state()
        if state is None:
            return EngineResult(insufficient_reason="Backend is still starting.")
        try:
            from .core_ai import answer as squad2  # type: ignore
        except ImportError:
            squad2 = None
        if squad2 is not None:
            raw = squad2(question, None)
            cites = [RawCitation(doc_id=c.get("gr_id") or state.corpus.gr_of_chunk(c["chunk_id"]),
                                 page=c.get("page") or 1, quote=c["quote"]) for c in raw.get("citations", [])]
            return EngineResult(answer=raw.get("answer") or None, citations=cites,
                                insufficient_reason=raw.get("refusal_reason"))
        hits = [h for h in state.vectors.search(question, k=3) if h["score"] >= self.MIN_SCORE]
        if not hits:
            return EngineResult(insufficient_reason="No relevant GR found in the corpus.")
        cites = [RawCitation(doc_id=h["gr_id"], page=h["page"], quote=h["text"]) for h in hits]
        return EngineResult(
            answer="Retrieval-only answer (answer engine not connected). Most relevant passage: " + hits[0]["text"],
            citations=cites,
        )
