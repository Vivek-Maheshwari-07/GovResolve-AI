"""API contract shared with Squads 1, 2 and 4.

Edge direction: ``source`` is the newer document that acts on ``target``
(e.g. source "supersedes" target).
"""
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class Relation(str, Enum):
    AMENDS = "amends"
    REPLACES = "replaces"
    SUPERSEDES = "supersedes"
    CANCELS = "cancels"
    REFERS_TO = "refers_to"


class LineageStatus(str, Enum):
    SUPERSEDED = "superseded"
    AMENDED = "amended"
    NO_LATER_AMENDMENT_FOUND = "no_later_amendment_found"
    UNKNOWN = "unknown"


class Verdict(str, Enum):
    ANSWERED = "answered"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class PageText(BaseModel):
    page: int = Field(ge=1)
    text: str


class DocumentMeta(BaseModel):
    doc_id: str
    gr_number: str | None = None
    department: str | None = None
    subject: str | None = None
    issue_date: date | None = None
    language: str | None = None
    pdf_url: str | None = None
    is_external: bool = False


class DocumentIn(DocumentMeta):
    """Payload Squad 1 sends per ingested document."""

    pages: list[PageText]


class Evidence(BaseModel):
    page: int
    quote: str


class Edge(BaseModel):
    source: str
    target: str
    relation: Relation
    evidence: Evidence | None = None
    warnings: list[str] = Field(default_factory=list)


class UnresolvedReference(BaseModel):
    relation: Relation
    page: int
    quote: str
    reason: str


class IngestResult(BaseModel):
    doc_id: str
    edges_added: list[Edge]
    unresolved: list[UnresolvedReference]
    external_stubs_created: list[str]
    warnings: list[str] = Field(default_factory=list)


class LineageInfo(BaseModel):
    doc_id: str
    status: LineageStatus
    summary: str
    acted_on_by: list[Edge] = Field(default_factory=list)
    latest_doc_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class LineageNode(BaseModel):
    meta: DocumentMeta
    status: LineageStatus


class LineageGraphResponse(BaseModel):
    root: str
    nodes: list[LineageNode]
    edges: list[Edge]
    timeline: list[str]


class DocumentDetail(BaseModel):
    meta: DocumentMeta
    lineage: LineageInfo


class RawCitation(BaseModel):
    """What Squad 2's engine returns per supporting passage."""

    doc_id: str
    page: int = Field(ge=1)
    quote: str
    bbox: list[float] | None = None


class Citation(BaseModel):
    doc_id: str
    page: int
    quote: str
    issue_date: date | None = None
    bbox: list[float] | None = None
    lineage: LineageInfo


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    language: str | None = None


class QueryResponse(BaseModel):
    verdict: Verdict
    answer: str | None = None
    citations: list[Citation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    reason: str | None = None
    language: str
