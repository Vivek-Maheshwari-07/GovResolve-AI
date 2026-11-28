"""Shared grounded query evaluation used by `/query`, `/query/stream` and `/voice/query`."""
from __future__ import annotations

import os
import re
from typing import Callable

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
from .schemas.member_a import Citation, Suggestion

_SENTENCE_ID = re.compile(r"\s*[\[(]\s*S\d+(?:\s*,\s*S\d+)*\s*[\])]")
# "No amendment has changed ...", "it has not been amended", "કોઈ સુધારો થયો નથી" (no amendment was made)
_DENIES_CHANGE = re.compile(
    r"\bno (?:later |subsequent )?(?:amendment|change|modification)s?\b(?! (?:to|in) the (?:\d|age|limit))"
    r"|\b(?:has|have|was|were) not been (?:amended|modified|superseded|changed by)"
    r"|\bnot (?:been )?amended\b"
    r"|કોઈ\s+સુધારો\s+(?:થયો|કરવામાં\s+આવ્યો)\s+નથી|સુધારો\s+થયો\s+નથી", re.I)


def _strip_sentence_ids(text: str | None) -> str | None:
    """The model sometimes leaves evidence ids in its prose ("... (S1) ..."): they mean nothing to a reader."""
    return _SENTENCE_ID.sub("", text).strip() if text else text


def _remap_statement(st: Statement, kept: dict[int, int]) -> Statement:
    """Point a statement at the citations that survived; an "established" one left with none is only inferred."""
    cites = [kept[i] for i in st.citations if i in kept]
    label = st.label
    if label is StatementLabel.ESTABLISHED and not cites:
        label = StatementLabel.INFERRED
    return Statement(text=_strip_sentence_ids(st.text), label=label, citations=cites)


def _infer_answer_language(answer: str | None) -> str | None:
    if not answer:
        return None
    if any("઀" <= c <= "૿" for c in answer):
        return "gu"
    if any(c.isascii() and c.isalpha() for c in answer):
        return "en"
    return None


def resolve_languages(question: str, requested_language: str | None) -> tuple[str | None, str]:
    """(explicit, language): the language the user asked for (selector or "answer in Gujarati" in the question), and the
    language passed to the engine (the explicit one, else the detected language of the question)."""
    req = (requested_language or "").strip().lower()
    explicit = None if req in ("", "auto") else req
    if not explicit:
        explicit = detect_requested_language(question)
    return explicit, explicit or detect_language(question)


# Wrongly mapped legacy Gujarati fonts leave text like "ચનયમ-3ના" (for "નિયમ-3ના"). Such a reference is not worth quoting, and a
# translation model asked to translate it refuses, so a warning says "an earlier provision" instead.
_UNREADABLE_REF = re.compile("ચનયમ|વવભાગ|અચધચનયમ|ચવભાગ|ચનણણય|[\u0100-\u02ff\ufffd]")


def readable_ref(ref: str) -> str:
    return "an earlier provision" if _UNREADABLE_REF.search(str(ref)) else str(ref)


def evaluate_query(
    question: str,
    requested_language: str | None,
    graph: LineageGraph,
    engine: AnswerEngine,
    progress: Callable[[dict], None] | None = None,
) -> QueryResponse:
    """Run the answer engine (reporting each step to `progress` when the engine supports it), verify citations against
    `graph`, and attach lineage/broken-chain warnings."""
    explicit, language = resolve_languages(question, requested_language)
    if progress is not None and getattr(engine, "supports_progress", False):
        result = engine.answer(question, language, progress=progress)
    else:
        result = engine.answer(question, language)
    inferred = _infer_answer_language(result.answer)
    if language in ("gujlish", "mixed") and inferred == "en":
        inferred = language  # an answer in Latin letters to a Gujlish question is Gujlish, not English
    return build_response(result, graph, engine, explicit or inferred or getattr(result, "language", None) or language)


def build_response(result, graph: LineageGraph, engine: AnswerEngine, language: str) -> QueryResponse:
    citations: list[Citation] = []
    warnings: list[str] = list(result.warnings)
    vector_off = getattr(engine, "vector_warning", lambda: None)()
    if vector_off:
        warnings.append(vector_off)
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
            warnings.append(f"{raw.doc_id} is superseded ({lineage.summary}); this passage may no longer apply.")
        elif lineage.status is LineageStatus.AMENDED:
            warnings.append(
                f"{raw.doc_id} has been amended ({lineage.summary}); read the passage together with the amendment."
            )
        elif lineage.status is LineageStatus.UNKNOWN:
            warnings.append(f"Current applicability of {raw.doc_id} cannot be established.")

    # A cited GR that changes a GR we do not hold: say so. Refusing when every citation is only an amendment of a
    # missing base is opt-in (GOV_BROKEN_CHAIN_REFUSES=1): the scorecard showed it refuses questions the amendment
    # answers by itself (e.g. "from which date is this amendment in force?"), so by default we answer with the warning.
    fragments: list[str] = []
    for cit in citations:
        broken = graph.broken_links(cit.doc_id)
        for rel, ref in broken:
            warnings.append(f"BROKEN_CHAIN: {cit.doc_id} {rel.value} {readable_ref(ref)}, which is not in the collection; "
                            "the text it changes cannot be checked.")
        if any(rel is Relation.AMENDS for rel, _ in broken):
            fragments.append(cit.doc_id)
    warnings = list(dict.fromkeys(warnings))   # one warning per fact
    if (os.environ.get("GOV_BROKEN_CHAIN_REFUSES") == "1" and result.answer and citations
            and len(set(fragments)) == len({c.doc_id for c in citations})):
        return QueryResponse(
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            reason="Every document found only amends a GR that is not in the collection, so the full rule "
                   "cannot be established: " + ", ".join(sorted(set(fragments))) + ".",
            reason_code=ReasonCode.BROKEN_CHAIN,
            warnings=warnings,
            language=language,
        )

    if not result.answer or not citations:
        return QueryResponse(
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            reason=result.insufficient_reason or "The available documents do not support an answer.",
            reason_code=result.reason_code or ReasonCode.NO_DOCUMENT,
            warnings=warnings,
            language=language,
            suggestions=[Suggestion(**s) for s in result.suggestions],
            follow_up_options=list(result.follow_up_options),
        )
    statements = [_remap_statement(st, kept) for st in result.statements]
    answer = _strip_sentence_ids(result.answer)
    # Lineage is decided by explicit references, never by the model: a statement denying an amendment that the graph
    # records for a cited GR is removed, and the amending order is named instead.
    changed = {c.doc_id: c.lineage for c in citations if c.lineage.status in (LineageStatus.AMENDED, LineageStatus.SUPERSEDED)}
    if changed and statements:
        denying = [st for st in statements if _DENIES_CHANGE.search(st.text)]
        if denying and len(denying) < len(statements):
            statements = [st for st in statements if st not in denying]
            answer = " ".join(st.text for st in statements)
            for doc_id, lin in changed.items():
                warnings.append(f"A sentence saying no amendment was made was removed: {doc_id} has been "
                                f"{lin.status.value} ({lin.summary}). Read the amending order.")
    return QueryResponse(
        verdict=Verdict.ANSWERED,
        answer=answer,
        citations=citations,
        warnings=warnings,
        language=language,
        statements=statements,
    )
