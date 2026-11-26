from typing import Any

from pydantic import BaseModel, Field

from .lineage import AnswerStatus, ChunkLineage, LineageEdge


class AnnotateRequest(BaseModel):
    chunk_ids: list[str]


class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    lang: str | None = None
    filters: dict[str, Any] | None = None


class Citation(BaseModel):
    chunk_id: str
    gr_id: str | None = None
    page: int | None = None
    quote: str | None = None
    bbox: dict[str, float] | None = None
    score: float | None = None
    lineage: ChunkLineage | None = None


class AskResponse(BaseModel):
    query_id: str
    question: str
    answer: str
    answer_status: AnswerStatus
    refusal_reason: str | None = None
    citations: list[Citation] = Field(default_factory=list)
    latency_ms: int = 0


class FeedbackIn(BaseModel):
    query_id: str
    verdict: str  # "up" | "down"
    note: str | None = None


class EdgeOverrideIn(BaseModel):
    added: list[LineageEdge] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)  # edge_ids
    author: str
    note: str | None = None


class VoiceQueryRequest(BaseModel):
    question: str | None = Field(default=None, max_length=2000)
    query: str | None = Field(default=None, max_length=2000)
    text: str | None = Field(default=None, max_length=2000)
    language: str | None = None
    lang: str | None = None
    call_id: str | None = None
    caller: str | None = None
    max_sentences: int = Field(default=3, ge=1, le=6)


class VoiceCitationSummary(BaseModel):
    doc_id: str
    gr_number: str | None = None
    issue_date: str | None = None
    page: int
    status: str


class VoiceQueryResponse(BaseModel):
    verdict: str
    spoken_answer: str
    answer: str | None = None
    language: str
    reason_code: str | None = None
    citations: list[VoiceCitationSummary] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    latency_ms: int = 0
