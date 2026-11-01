"""
GovResolve-AI — Shared Data Models (frozen Day 1)
Defines the canonical JSON record for a GR and all enum types.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enumerations
# ──────────────────────────────────────────────

class SourceType(str, Enum):
    DIGITAL = "digital"
    SCANNED = "scanned"
    MIXED   = "mixed"

class Language(str, Enum):
    GU    = "gu"
    EN    = "en"
    MIXED = "mixed"

class ClauseStatus(str, Enum):
    ACTIVE     = "Active"
    AMENDED    = "Amended"
    SUPERSEDED = "Superseded"
    ABROGATED  = "Abrogated"
    UNKNOWN    = "Unknown"

class AnswerStatus(str, Enum):
    NO_LATER_CHANGE = "Found, no later change"
    AMENDED         = "Found, amended"
    SUPERSEDED      = "Found, superseded"
    CONFLICT        = "Conflict"
    INSUFFICIENT    = "Insufficient Evidence"

class InsufficientReason(str, Enum):
    NO_DOCUMENT  = "NO_DOCUMENT"
    TOO_VAGUE    = "TOO_VAGUE"
    MISSING_FACTS= "MISSING_FACTS"
    BROKEN_CHAIN = "BROKEN_CHAIN"
    POOR_SCAN    = "POOR_SCAN"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"

class StatementLabel(str, Enum):
    ESTABLISHED = "Established"
    INFERRED    = "Inferred"
    NOT_FOUND   = "Not found"

class LineageType(str, Enum):
    SUPERSEDES  = "SUPERSEDES"
    AMENDS      = "AMENDS"
    SUBSTITUTES = "SUBSTITUTES"
    CANCELS     = "CANCELS"
    CLARIFIES   = "CLARIFIES"
    REFERS      = "REFERS"

class LinkConfidence(str, Enum):
    EXPLICIT  = "explicit"    # GR number named
    PROBABLE  = "probable"    # date/subject match
    UNKNOWN   = "unknown"


# ──────────────────────────────────────────────
# Sub-models
# ──────────────────────────────────────────────

class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float
    page: int

class TextBlock(BaseModel):
    block_id:   str
    text:       str
    text_clean: str          # normalised (digits, whitespace)
    bbox:       BoundingBox
    ocr_confidence: Optional[float] = None  # None for digital pages

class PageRecord(BaseModel):
    page_number: int
    source_type: SourceType
    ocr_confidence: Optional[float] = None
    width:  float = 0
    height: float = 0
    blocks: list[TextBlock] = Field(default_factory=list)

class Chunk(BaseModel):
    chunk_id:    str          # e.g. GAD-2021-0147_p2_c01
    gr_id:       str
    text:        str
    text_clean:  str
    pages:       list[int]
    bboxes:      list[BoundingBox]
    chunk_type:  str          # clause | paragraph | table | preamble
    section_ref: Optional[str] = None   # e.g. "Para 3(ii)"
    ocr_confidence: Optional[float] = None
    clause_status: ClauseStatus = ClauseStatus.UNKNOWN  # filled by Squad 3

class LineageEdge(BaseModel):
    from_gr_id:   str
    to_gr_id:     Optional[str]  # None if BROKEN_CHAIN
    to_gr_number: Optional[str]  # raw number extracted
    link_type:    LineageType
    scope:        str            # "whole_gr" | "para 3" | "clause 2(b)"
    proof_text:   str            # sentence that triggered this
    proof_page:   int
    confidence:   LinkConfidence
    effective_date: Optional[str] = None  # YYYY-MM-DD

class GRRecord(BaseModel):
    """Canonical standard record — frozen on Day 1."""
    gr_id:       str           # GAD-2021-0147
    gr_number:   str           # as printed on the GR
    department:  str
    issue_date:  Optional[str] = None   # YYYY-MM-DD
    effective_date: Optional[str] = None
    subject:     str
    language:    Language
    source_type: SourceType    # majority type
    file_path:   str           # path to original PDF
    pages:       list[PageRecord] = Field(default_factory=list)
    chunks:      list[Chunk]   = Field(default_factory=list)
    references:  list[LineageEdge] = Field(default_factory=list)
    metadata_confidence: Optional[float] = None
    raw_text:    str = ""


# ──────────────────────────────────────────────
# API Response Models
# ──────────────────────────────────────────────

class Citation(BaseModel):
    gr_id:       str
    gr_number:   str
    issue_date:  Optional[str]
    page:        int
    passage:     str
    bbox:        Optional[BoundingBox] = None
    ocr_confidence: Optional[float] = None

class AnswerStatement(BaseModel):
    text:   str
    label:  StatementLabel
    citations: list[Citation]

class LineageNode(BaseModel):
    gr_id:     str
    gr_number: str
    date:      Optional[str]
    status:    ClauseStatus
    edges_out: list[LineageEdge] = Field(default_factory=list)

class QueryResponse(BaseModel):
    question:        str
    answer_status:   AnswerStatus
    insufficient_reason: Optional[InsufficientReason] = None
    summary:         str
    statements:      list[AnswerStatement] = Field(default_factory=list)
    citations:       list[Citation]        = Field(default_factory=list)
    lineage_chain:   list[LineageNode]     = Field(default_factory=list)
    follow_up_question: Optional[str]      = None
    collection_latest_date: Optional[str]  = None   # for "no later change" caveat
    language_detected: Language = Language.EN

