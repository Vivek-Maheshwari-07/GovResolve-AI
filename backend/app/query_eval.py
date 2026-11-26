"""Shared grounded query evaluation used by both `/query` and `/voice/query`."""
from __future__ import annotations

import os

from .engine import AnswerEngine
from .graph import LineageGraph
from .normalize import detect_language, detect_requested_language
from .schemas import (
    LineageStatus,
    QueryResponse,
    ReasonCode,
    Relation,
    Statement,
    StatementLabel,
    Verdict,
)
from .schemas.member_a import Citation


def _remap_statement(st: Statement, kept: dict[int, int]) -> Statement:
    """Point a statement at the citations that survived; an "established" one left with none is only inferred."""
    cites = [kept[i] for i in st.citations if i in kept]
    label = st.label
    if label is StatementLabel.ESTABLISHED and not cites:
        label = StatementLabel.INFERRED
    return Statement(text=st.text, label=label, citations=cites)


def _infer_answer_language(answer: str | None) -> str | None:
    if not answer:
        return None
    if any("઀" <= c <= "૿" for c in answer):
        return "gu"
    if any(c.isascii() and c.isalpha() for c in answer):
        return "en"
    return None


def evaluate_query(
    question: str,
    requested_language: str | None,
    graph: LineageGraph,
    engine: AnswerEngine,
) -> QueryResponse:
    """Run the answer engine, verify citations against `graph`, and attach lineage/broken-chain warnings."""
    req = (requested_language or "").strip().lower()
    explicit = None if req in ("", "auto") else req
    if not explicit:
        explicit = detect_requested_language(question)
    language = explicit or detect_language(question)
    result = engine.answer(question, language)
    response_language = explicit or _infer_answer_language(result.answer) or result.language or language

    citations: list[Citation] = []
    warnings: list[str] = list(result.warnings)
    kept: dict[int, int] = {}  # engine citation index -> response citation index
    for i, raw in enumerate(result.citations):
        meta = graph.get_meta(raw.doc_id)
        if meta is None:
            warnings.append(f"Dropped citation to unknown document {raw.doc_id!r}.")
            continue
        kept[i] = len(citations)
        lineage = graph.status_of(raw.doc_id)
        citations.append(
            Citation(
                doc_id=raw.doc_id,
                page=raw.page,
                quote=raw.quote,
                issue_date=meta.issue_date,
                bbox=raw.bbox,
                lineage=lineage,
            )
        )
        if lineage.status is LineageStatus.SUPERSEDED:
            warnings.append(
                f"{raw.doc_id} is superseded ({lineage.summary}); this passage may no longer apply."
            )
        elif lineage.status is LineageStatus.AMENDED:
            warnings.append(
                f"{raw.doc_id} has been amended ({lineage.summary}); read the passage together with the amendment."
            )
        elif lineage.status is LineageStatus.UNKNOWN:
            warnings.append(f"Current applicability of {raw.doc_id} cannot be established.")

    fragments: list[str] = []
    for cit in citations:
        broken = graph.broken_links(cit.doc_id)
        for rel, ref in broken:
            warnings.append(
                f"BROKEN_CHAIN: {cit.doc_id} {rel.value} {ref}, which is not in the collection; "
                "the text it changes cannot be checked."
            )
        if any(rel is Relation.AMENDS for rel, _ in broken):
            fragments.append(cit.doc_id)
    if (
        os.environ.get("GOV_BROKEN_CHAIN_REFUSES") == "1"
        and result.answer
        and citations
        and len(set(fragments)) == len({c.doc_id for c in citations})
    ):
        return QueryResponse(
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            reason="Every document found only amends a GR that is not in the collection, so the full rule "
            "cannot be established: " + ", ".join(sorted(set(fragments))) + ".",
            reason_code=ReasonCode.BROKEN_CHAIN,
            warnings=warnings,
            language=response_language,
        )

    if not result.answer or not citations:
        return QueryResponse(
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            reason=result.insufficient_reason or "The available documents do not support an answer.",
            reason_code=result.reason_code or ReasonCode.NO_DOCUMENT,
            warnings=warnings,
            language=response_language,
        )
    return QueryResponse(
        verdict=Verdict.ANSWERED,
        answer=result.answer,
        citations=citations,
        warnings=warnings,
        language=response_language,
        statements=[_remap_statement(st, kept) for st in result.statements],
    )
