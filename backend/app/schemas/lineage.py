from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class RelType(str, Enum):
    SUPERSEDES = "SUPERSEDES"
    AMENDS = "AMENDS"
    SUBSTITUTES = "SUBSTITUTES"
    CANCELS = "CANCELS"
    CLARIFIES = "CLARIFIES"
    RESTORES = "RESTORES"
    REFERS = "REFERS"


class Confidence(str, Enum):
    EXPLICIT = "EXPLICIT"
    PROBABLE = "PROBABLE"


class Scope(str, Enum):
    WHOLE = "WHOLE"
    PARAGRAPH = "PARAGRAPH"
    CLAUSE = "CLAUSE"
    UNKNOWN = "UNKNOWN"


class ClauseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    AMENDED = "AMENDED"
    SUPERSEDED = "SUPERSEDED"
    ABROGATED = "ABROGATED"
    CONFLICT = "CONFLICT"
    UNKNOWN = "UNKNOWN"


class AnswerStatus(str, Enum):
    FOUND_NO_LATER_CHANGE = "FOUND_NO_LATER_CHANGE"
    FOUND_AMENDED = "FOUND_AMENDED"
    FOUND_SUPERSEDED = "FOUND_SUPERSEDED"
    CONFLICT = "CONFLICT"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


# Worst first: the whole answer takes the worst status among its citations.
ANSWER_STATUS_SEVERITY = [
    AnswerStatus.INSUFFICIENT_EVIDENCE,
    AnswerStatus.CONFLICT,
    AnswerStatus.FOUND_SUPERSEDED,
    AnswerStatus.FOUND_AMENDED,
    AnswerStatus.FOUND_NO_LATER_CHANGE,
]

CLAUSE_TO_ANSWER = {
    ClauseStatus.ACTIVE: AnswerStatus.FOUND_NO_LATER_CHANGE,
    ClauseStatus.AMENDED: AnswerStatus.FOUND_AMENDED,
    ClauseStatus.SUPERSEDED: AnswerStatus.FOUND_SUPERSEDED,
    ClauseStatus.ABROGATED: AnswerStatus.FOUND_SUPERSEDED,
    ClauseStatus.CONFLICT: AnswerStatus.CONFLICT,
    ClauseStatus.UNKNOWN: AnswerStatus.INSUFFICIENT_EVIDENCE,
}


def worst_status(statuses: list[AnswerStatus]) -> AnswerStatus:
    if not statuses:
        return AnswerStatus.INSUFFICIENT_EVIDENCE
    return min(statuses, key=ANSWER_STATUS_SEVERITY.index)


class LineageEdge(BaseModel):
    """Points from the newer GR (source) to the older GR it changes (target)."""

    edge_id: str
    source_gr: str
    target_gr: str | None  # None = broken link (target not in corpus)
    rel_type: RelType
    confidence: Confidence = Confidence.EXPLICIT
    method: Literal["regex", "llm", "manual"] = "regex"
    scope: Scope = Scope.WHOLE
    target_clauses: list[str] = Field(default_factory=list)
    target_ref_text: str | None = None
    evidence_text: str | None = None
    evidence_chunk_id: str | None = None
    effective_date: date | None = None


class ChunkLineage(BaseModel):
    chunk_id: str
    gr_id: str
    status: ClauseStatus = ClauseStatus.ACTIVE
    answer_status: AnswerStatus = AnswerStatus.FOUND_NO_LATER_CHANGE
    reason_code: str | None = None  # PROBABLE_ONLY, CYCLE, SAME_DATE, BROKEN_CHAIN, POOR_SCAN
    changed_by: list[LineageEdge] = Field(default_factory=list)
    latest_gr_ids: list[str] = Field(default_factory=list)
    latest_chunk_ids: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
