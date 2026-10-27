"""Lineage graph: documents as nodes, explicit amendment/supersession as edges.

Edges point from the newer acting document to the older target. Referenced
documents that are not in the corpus become ``ext:`` stub nodes, so a gap in
the corpus is visible instead of silently dropped.
"""
from __future__ import annotations

import hashlib
import json
import threading
from datetime import date
from pathlib import Path

import networkx as nx

from .detector import Reference, detect
from .normalize import gr_key, gr_similarity
from .schemas import (
    DocumentIn,
    DocumentMeta,
    Edge,
    Evidence,
    IngestResult,
    LineageGraphResponse,
    LineageInfo,
    LineageNode,
    LineageStatus,
    PageText,
    Relation,
    UnresolvedReference,
)

ENDING = {Relation.SUPERSEDES, Relation.REPLACES, Relation.CANCELS}
FUZZY_THRESHOLD = 0.88

_VERB = {
    Relation.SUPERSEDES: "superseded",
    Relation.REPLACES: "replaced",
    Relation.CANCELS: "cancelled",
    Relation.AMENDS: "amended",
}


def _score(key: str | None, d: date | None, meta: DocumentMeta) -> int:
    """0 = no match, 1 = approximate, 2 = GR number, 3 = GR number and date."""
    meta_key = gr_key(meta.gr_number) if meta.gr_number else None
    dates_equal = bool(d and meta.issue_date and d == meta.issue_date)
    dates_conflict = bool(d and meta.issue_date and d != meta.issue_date)
    if key and meta_key:
        if dates_conflict:
            return 0
        if key == meta_key:
            return 3 if dates_equal else 2
        if dates_equal and gr_similarity(key, meta_key) >= FUZZY_THRESHOLD:
            return 1
        return 0
    if not key and dates_equal:
        return 1
    return 0


def _stub_id(ref: Reference) -> str:
    key = gr_key(ref.gr_number) if ref.gr_number else "date"
    return f"ext:{key}:{ref.issue_date.isoformat() if ref.issue_date else 'nodate'}"


def _edge_key(relation: Relation, page: int, quote: str) -> str:
    digest = hashlib.sha1(quote.encode("utf-8")).hexdigest()[:10]
    return f"{relation.value}:{page}:{digest}"


class LineageGraph:
    def __init__(self) -> None:
        self._g = nx.MultiDiGraph()
        self._lock = threading.RLock()

    # ---- ingestion -------------------------------------------------

    def add_document(self, doc: DocumentIn) -> IngestResult:
        with self._lock:
            meta = DocumentMeta(**doc.model_dump(exclude={"pages"}))
            meta.is_external = False
            self._remove_outgoing(meta.doc_id)
            self._g.add_node(meta.doc_id, meta=meta)
            self._absorb_stubs(meta)

            added: list[Edge] = []
            unresolved: list[UnresolvedReference] = []
            stubs: list[str] = []
            warnings: list[str] = []

            for hit in detect(doc.pages):
                if hit.reference is None:
                    unresolved.append(
                        UnresolvedReference(
                            relation=hit.relation,
                            page=hit.page,
                            quote=hit.quote,
                            reason="Trigger phrase found but no GR number or date in the same sentence.",
                        )
                    )
                    continue
                target, score, ambiguous = self._resolve(hit.reference)
                if ambiguous:
                    unresolved.append(
                        UnresolvedReference(
                            relation=hit.relation,
                            page=hit.page,
                            quote=hit.quote,
                            reason="Reference matches more than one document in the corpus.",
                        )
                    )
                    continue
                if target is None:
                    target = self._make_stub(hit.reference)
                    stubs.append(target)
                elif score == 1:
                    warnings.append(f"Reference on page {hit.page} matched {target} only approximately.")
                if target == meta.doc_id:
                    continue
                key = _edge_key(hit.relation, hit.page, hit.quote)
                self._g.add_edge(
                    meta.doc_id,
                    target,
                    key=key,
                    relation=hit.relation,
                    evidence=Evidence(page=hit.page, quote=hit.quote),
                )
                added.append(self._edge(meta.doc_id, target, key))

            return IngestResult(
                doc_id=meta.doc_id,
                edges_added=added,
                unresolved=unresolved,
                external_stubs_created=sorted(set(stubs)),
                warnings=warnings,
            )

    def _remove_outgoing(self, doc_id: str) -> None:
        if doc_id in self._g:
            self._g.remove_edges_from(list(self._g.out_edges(doc_id, keys=True)))

    def _resolve(self, ref: Reference) -> tuple[str | None, int, bool]:
        key = gr_key(ref.gr_number) if ref.gr_number else None
        best: list[str] = []
        best_score = 0
        for node_id, data in self._g.nodes(data=True):
            score = _score(key, ref.issue_date, data["meta"])
            if score > best_score:
                best, best_score = [node_id], score
            elif score == best_score and score > 0:
                best.append(node_id)
        if not best:
            return None, 0, False
        if len(best) > 1:
            real = [n for n in best if not self._g.nodes[n]["meta"].is_external]
            if len(real) == 1:
                return real[0], best_score, False
            return None, best_score, True
        return best[0], best_score, False

    def _make_stub(self, ref: Reference) -> str:
        stub = _stub_id(ref)
        if stub not in self._g:
            self._g.add_node(
                stub,
                meta=DocumentMeta(
                    doc_id=stub,
                    gr_number=ref.gr_number,
                    issue_date=ref.issue_date,
                    is_external=True,
                ),
            )
        return stub

    def _absorb_stubs(self, real: DocumentMeta) -> None:
        """Re-point edges of matching external stubs to a newly ingested document."""
        for stub_id in [n for n, d in self._g.nodes(data=True) if d["meta"].is_external]:
            stub = self._g.nodes[stub_id]["meta"]
            stub_key = gr_key(stub.gr_number) if stub.gr_number else None
            if _score(stub_key, stub.issue_date, real) == 0:
                continue
            for u, _, k, data in list(self._g.in_edges(stub_id, keys=True, data=True)):
                if u != real.doc_id:
                    self._g.add_edge(u, real.doc_id, key=k, **data)
            for _, v, k, data in list(self._g.out_edges(stub_id, keys=True, data=True)):
                if v != real.doc_id:
                    self._g.add_edge(real.doc_id, v, key=k, **data)
            self._g.remove_node(stub_id)

    # ---- queries ---------------------------------------------------

    def __contains__(self, doc_id: str) -> bool:
        return doc_id in self._g

    def get_meta(self, doc_id: str) -> DocumentMeta | None:
        with self._lock:
            return self._g.nodes[doc_id]["meta"] if doc_id in self._g else None

    def list_documents(self, include_external: bool = False) -> list[DocumentMeta]:
        with self._lock:
            metas = [d["meta"] for _, d in self._g.nodes(data=True)]
            return [m for m in metas if include_external or not m.is_external]

    def _date(self, doc_id: str) -> date | None:
        return self._g.nodes[doc_id]["meta"].issue_date

    def _date_conflict(self, source: str, target: str) -> bool:
        ds, dt = self._date(source), self._date(target)
        return bool(ds and dt and ds < dt)

    def _edge(self, u: str, v: str, key: str) -> Edge:
        data = self._g.edges[u, v, key]
        warnings: list[str] = []
        if data["relation"] is not Relation.REFERS_TO:
            if self._date_conflict(u, v):
                warnings.append("date_conflict: acting document is dated before its target")
            elif not (self._date(u) and self._date(v)):
                warnings.append("date_unverified: an issue date is missing")
        warnings.extend(data.get("extra_warnings", []))
        return Edge(
            source=u,
            target=v,
            relation=data["relation"],
            evidence=data["evidence"],
            warnings=warnings,
        )

    def edges(self) -> list[Edge]:
        with self._lock:
            return [self._edge(u, v, k) for u, v, k in self._g.edges(keys=True)]

    def _incoming(self, doc_id: str, relations: set[Relation]) -> tuple[list[Edge], list[Edge]]:
        valid: list[Edge] = []
        conflicted: list[Edge] = []
        for u, _, k, data in self._g.in_edges(doc_id, keys=True, data=True):
            if data["relation"] not in relations:
                continue
            (conflicted if self._date_conflict(u, doc_id) else valid).append(self._edge(u, doc_id, k))
        return valid, conflicted

    def _newer_chain(self, doc_id: str) -> tuple[list[str], bool]:
        """Terminal documents reachable via ending relations, and whether a cycle was hit."""
        newer = nx.DiGraph()
        for u, v, data in self._g.edges(data=True):
            if data["relation"] in ENDING and not self._date_conflict(u, v):
                newer.add_edge(v, u)
        if doc_id not in newer:
            return [], False
        reach = nx.descendants(newer, doc_id) | {doc_id}
        sub = newer.subgraph(reach)
        if not nx.is_directed_acyclic_graph(sub):
            return [], True
        return sorted(n for n in reach if n != doc_id and sub.out_degree(n) == 0), False

    def _corpus_note(self) -> str:
        n = sum(1 for _, d in self._g.nodes(data=True) if not d["meta"].is_external)
        return (
            f"Based only on the {n} ingested documents; the absence of a later order here "
            "does not prove the rule is still in force."
        )

    def status_of(self, doc_id: str) -> LineageInfo:
        with self._lock:
            if doc_id not in self._g:
                return LineageInfo(
                    doc_id=doc_id,
                    status=LineageStatus.UNKNOWN,
                    summary="Document is not in the lineage graph.",
                )
            notes: list[str] = []
            if self._g.nodes[doc_id]["meta"].is_external:
                notes.append("Referenced by other documents but its text is not in the corpus.")

            ending, ending_bad = self._incoming(doc_id, ENDING)
            amending, amending_bad = self._incoming(doc_id, {Relation.AMENDS})
            for e in ending_bad + amending_bad:
                notes.append(f"Ignored {e.relation.value} by {e.source}: it is dated before this document.")

            if ending:
                latest, cycle = self._newer_chain(doc_id)
                if cycle:
                    notes.append("Circular supersession chain detected; latest order cannot be determined.")
                    return LineageInfo(
                        doc_id=doc_id,
                        status=LineageStatus.UNKNOWN,
                        summary="Supersession chain is circular.",
                        acted_on_by=ending,
                        notes=notes,
                    )
                if latest:
                    notes.append(f"Latest instruction(s) in the corpus: {', '.join(latest)}.")
                return LineageInfo(
                    doc_id=doc_id,
                    status=LineageStatus.SUPERSEDED,
                    summary=self._summary(ending),
                    acted_on_by=ending,
                    latest_doc_ids=latest,
                    notes=notes,
                )

            if amending:
                for e in amending:
                    if self._incoming(e.source, ENDING)[0]:
                        notes.append(f"Amending order {e.source} is itself superseded; check its successor.")
                notes.append(self._corpus_note())
                return LineageInfo(
                    doc_id=doc_id,
                    status=LineageStatus.AMENDED,
                    summary=self._summary(amending),
                    acted_on_by=amending,
                    latest_doc_ids=sorted({e.source for e in amending}),
                    notes=notes,
                )

            if ending_bad or amending_bad:
                return LineageInfo(
                    doc_id=doc_id,
                    status=LineageStatus.UNKNOWN,
                    summary="Only inconsistent amendment references were found.",
                    notes=notes,
                )

            notes.append(self._corpus_note())
            return LineageInfo(
                doc_id=doc_id,
                status=LineageStatus.NO_LATER_AMENDMENT_FOUND,
                summary="No later amendment or superseding order found in the corpus.",
                notes=notes,
            )

    def _summary(self, edges: list[Edge]) -> str:
        parts = []
        for e in edges:
            meta = self._g.nodes[e.source]["meta"]
            when = f" dated {meta.issue_date.isoformat()}" if meta.issue_date else ""
            parts.append(f"{_VERB[e.relation]} by {meta.gr_number or e.source}{when}")
        text = "; ".join(parts)
        return text[0].upper() + text[1:] + "."

    def lineage(self, doc_id: str) -> LineageGraphResponse | None:
        with self._lock:
            if doc_id not in self._g:
                return None
            core = nx.Graph()
            core.add_node(doc_id)
            for u, v, data in self._g.edges(data=True):
                if data["relation"] is not Relation.REFERS_TO:
                    core.add_edge(u, v)
            members = nx.node_connected_component(core, doc_id)
            nodes = [
                LineageNode(meta=self._g.nodes[n]["meta"], status=self.status_of(n).status)
                for n in members
            ]
            edges = [
                self._edge(u, v, k)
                for u, v, k in self._g.edges(keys=True)
                if u in members and v in members
            ]
            timeline = sorted(
                members,
                key=lambda n: (self._date(n) is None, self._date(n) or date.min, n),
            )
            return LineageGraphResponse(root=doc_id, nodes=nodes, edges=edges, timeline=timeline)

    # ---- persistence -----------------------------------------------

    def save(self, path: str | Path) -> None:
        with self._lock:
            payload = {
                "nodes": [d["meta"].model_dump(mode="json") for _, d in self._g.nodes(data=True)],
                "edges": [
                    {
                        "source": u,
                        "target": v,
                        "key": k,
                        "relation": d["relation"].value,
                        "evidence": d["evidence"].model_dump(),
                    }
                    for u, v, k, d in self._g.edges(keys=True, data=True)
                ],
            }
            Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> LineageGraph:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        graph = cls()
        for node in payload["nodes"]:
            meta = DocumentMeta(**node)
            graph._g.add_node(meta.doc_id, meta=meta)
        for e in payload["edges"]:
            graph._g.add_edge(
                e["source"],
                e["target"],
                key=e["key"],
                relation=Relation(e["relation"]),
                evidence=Evidence(**e["evidence"]),
            )
        return graph


_REL_MAP = {
    "SUPERSEDES": Relation.SUPERSEDES,
    "AMENDS": Relation.AMENDS,
    "SUBSTITUTES": Relation.AMENDS,
    "RESTORES": Relation.AMENDS,
    "CANCELS": Relation.CANCELS,
    "CLARIFIES": Relation.REFERS_TO,
    "REFERS": Relation.REFERS_TO,
}


def _doc_in(gr) -> DocumentIn | None:
    pages: dict[int, list[str]] = {}
    for ch in gr.chunks:
        pages.setdefault(ch.page, []).append(ch.text)
    if not pages:
        return None
    return DocumentIn(
        doc_id=gr.gr_id, gr_number=gr.gr_number, department=gr.department, subject=gr.subject,
        issue_date=gr.issue_date, language=gr.language, pdf_url=f"/grs/{gr.gr_id}/pdf",
        pages=[PageText(page=p, text="\n".join(t)) for p, t in sorted(pages.items())],
    )


def load_corpus(graph: LineageGraph, corpus, lineage=None) -> int:
    """Fill the document-level graph from a Squad 1 corpus; returns documents added.

    With `lineage` (the clause-level engine) its edges are the single source of truth, so the
    contract endpoints and `/ask` can never disagree. Without it the text detector is used.
    PROBABLE edges are downgraded to `amends` with a warning: they must never mark a GR superseded.
    """
    n = 0
    with graph._lock:
        for gr in corpus.grs.values():
            doc = _doc_in(gr)
            if doc is None:
                continue
            if lineage is None:
                graph.add_document(doc)
            else:
                graph._remove_outgoing(gr.gr_id)
                graph._g.add_node(gr.gr_id, meta=DocumentMeta(**doc.model_dump(exclude={"pages"})))
            n += 1
        if lineage is None:
            return n
        for e in lineage.edges():
            chunk = corpus.chunk(e.evidence_chunk_id) if e.evidence_chunk_id else None
            ev = Evidence(page=chunk.page if chunk else 1, quote=e.evidence_text or "")
            rel = _REL_MAP.get(e.rel_type.value, Relation.REFERS_TO)
            warns: list[str] = []
            if e.confidence.value != "EXPLICIT":
                warns.append("probable: reference inferred, not stated explicitly")
                if rel in ENDING:
                    rel = Relation.AMENDS
            target = e.target_gr
            if target is None:  # broken link -> external stub, shown greyed out
                ref = e.target_ref_text or "unknown"
                target = "ext:" + gr_key(ref)
                if target not in graph._g:
                    graph._g.add_node(target, meta=DocumentMeta(doc_id=target, gr_number=ref, is_external=True))
            graph._g.add_edge(e.source_gr, target, key=e.edge_id, relation=rel, evidence=ev, extra_warnings=warns)
    return n
