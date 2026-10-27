"""Interface to Squad 2's retrieval + answer engine."""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

from .schemas import RawCitation


class EngineResult(BaseModel):
    answer: str | None = None
    citations: list[RawCitation] = Field(default_factory=list)
    insufficient_reason: str | None = None


class AnswerEngine(Protocol):
    def answer(self, question: str, language: str) -> EngineResult: ...


class NullEngine:
    """Placeholder until Squad 2's engine is wired in; always refuses."""

    def answer(self, question: str, language: str) -> EngineResult:
        return EngineResult(insufficient_reason="No answer engine is connected yet.")
