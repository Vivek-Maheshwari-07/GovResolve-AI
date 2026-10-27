from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class BBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class Chunk(BaseModel):
    chunk_id: str
    page: int
    text: str
    clause_label: str | None = None
    section: Literal["read", "preamble", "operative", "other"] = "other"
    bbox: BBox | None = None


class GRRecord(BaseModel):
    """One record per GR, produced by Squad 1."""

    gr_id: str
    gr_number: str | None = None  # as printed, original script
    gr_number_norm: str | None = None  # Gujarati digits -> ASCII, spaces stripped
    department: str | None = None
    issue_date: date | None = None
    effective_date: date | None = None  # "w.e.f." if stated
    subject: str | None = None
    language: Literal["gu", "en", "mixed"] = "en"
    source_pdf: str | None = None  # path under data/raw
    page_count: int = 1
    chunks: list[Chunk] = Field(default_factory=list)
    field_confidence: dict[str, float] = Field(default_factory=dict)


class GRSummary(BaseModel):
    gr_id: str
    gr_number: str | None
    department: str | None
    issue_date: date | None
    subject: str | None
    language: str
    status: str
