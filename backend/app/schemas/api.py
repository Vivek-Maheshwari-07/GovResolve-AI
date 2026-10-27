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
