"""Stand-in for Member A's engine, so every endpoint works before the real one lands.

It takes edges as given (seeded or manual) and applies the status rules of plan section 4.7.
Swap it by making `app.lineage.LineageService` importable; main.py prefers that.
"""
from datetime import date

import networkx as nx

from ..schemas import (
    CLAUSE_TO_ANSWER, ChunkLineage, ClauseStatus, Confidence, LineageEdge, RelType, Scope,
)
from ..store.corpus import Corpus

CHANGING = {RelType.SUPERSEDES, RelType.AMENDS, RelType.SUBSTITUTES, RelType.CANCELS, RelType.RESTORES}
MAX_HOPS = 10


class StubLineageService:
    def __init__(self, corpus: Corpus, seed_edges: list[LineageEdge] | None = None):
        self.corpus = corpus
        self._seed = list(seed_edges or [])
        self._edges: list[LineageEdge] = []
        self._added: list[LineageEdge] = []
        self._removed: set[str] = set()
        self.build()

    def build(self) -> None:
        self._edges = list(self._seed)

    def apply_overrides(self, added: list[LineageEdge], removed: list[str]) -> None:
        self._added, self._removed = list(added), set(removed)

    def edges(self) -> list[LineageEdge]:
        by_id = {e.edge_id: e for e in self._edges if e.edge_id not in self._removed}
        by_id.update({e.edge_id: e for e in self._added})
        return list(by_id.values())

    def broken_links(self) -> list[LineageEdge]:
        return [e for e in self.edges() if e.target_gr is None]

    def _graph(self) -> nx.MultiDiGraph:
        g = nx.MultiDiGraph()
        g.add_nodes_from(self.corpus.grs)
        for e in self.edges():
            if e.target_gr and e.rel_type in CHANGING:
                g.add_edge(e.source_gr, e.target_gr, key=e.edge_id, edge=e)
        return g

    def cycles(self) -> list[list[str]]:
        return [c for c in nx.simple_cycles(nx.DiGraph(self._graph()))]

    @staticmethod
    def _hits(e: LineageEdge, label: str | None) -> bool:
        if e.scope in (Scope.WHOLE, Scope.UNKNOWN) or not e.target_clauses:
            return True
        return label is not None and label in e.target_clauses

    def chunk_status(self, chunk_id: str) -> ChunkLineage:
        gr_id = self.corpus.gr_of_chunk(chunk_id)
        chunk = self.corpus.chunk(chunk_id)
        if gr_id is None or chunk is None:
            raise KeyError(chunk_id)
        g = self._graph()
        in_cycle = any(gr_id in c for c in self.cycles())
        hits = [e for _, _, e in ((u, v, d["edge"]) for u, v, d in g.in_edges(gr_id, data=True))
                if self._hits(e, chunk.clause_label)]
        explicit = [e for e in hits if e.confidence == Confidence.EXPLICIT]
        status, reason, warnings = ClauseStatus.ACTIVE, None, []
        if in_cycle:
            status, reason = ClauseStatus.CONFLICT, "CYCLE"
        elif explicit:
            if any(e.rel_type == RelType.CANCELS and e.scope in (Scope.WHOLE,) for e in explicit):
                status = ClauseStatus.ABROGATED
            elif any(e.rel_type == RelType.SUPERSEDES and e.scope == Scope.WHOLE for e in explicit):
                status = ClauseStatus.SUPERSEDED
            else:
                status = ClauseStatus.AMENDED
        elif hits:
            status, reason = ClauseStatus.AMENDED, "PROBABLE_ONLY"
            warnings.append("Possible later change detected, not confirmed.")
        latest = self._latest(g, gr_id) if status in (ClauseStatus.SUPERSEDED, ClauseStatus.ABROGATED) else []
        latest_chunks = [c.chunk_id for lg in latest if (r := self.corpus.get(lg)) for c in r.chunks]
        return ChunkLineage(
            chunk_id=chunk_id, gr_id=gr_id, status=status, answer_status=CLAUSE_TO_ANSWER[status],
            reason_code=reason, changed_by=hits, latest_gr_ids=latest, latest_chunk_ids=latest_chunks,
            warnings=warnings,
        )

    @staticmethod
    def _latest(g: nx.MultiDiGraph, gr_id: str) -> list[str]:
        """Follow SUPERSEDES edges forward to the newest version (max 10 hops, no repeats)."""
        seen, cur = {gr_id}, gr_id
        for _ in range(MAX_HOPS):
            nxt = [u for u, _, d in g.in_edges(cur, data=True)
                   if d["edge"].rel_type == RelType.SUPERSEDES and u not in seen]
            if not nxt:
                break
            cur = nxt[0]
            seen.add(cur)
        return [cur] if cur != gr_id else []

    def gr_status(self, gr_id: str) -> ClauseStatus:
        rec = self.corpus.get(gr_id)
        if rec is None:
            raise KeyError(gr_id)
        order = [ClauseStatus.CONFLICT, ClauseStatus.UNKNOWN, ClauseStatus.SUPERSEDED, ClauseStatus.ABROGATED,
                 ClauseStatus.AMENDED, ClauseStatus.ACTIVE]
        found = {self.chunk_status(c.chunk_id).status for c in rec.chunks} or {ClauseStatus.ACTIVE}
        return min(found, key=order.index)

    def timeline(self, gr_id: str, hops: int = 5) -> dict:
        if self.corpus.get(gr_id) is None:
            raise KeyError(gr_id)
        g = nx.Graph(self._graph())
        near = nx.single_source_shortest_path_length(g, gr_id, cutoff=hops)
        nodes = []
        for n in near:
            r = self.corpus.get(n)
            nodes.append({"gr_id": n, "gr_number": r.gr_number, "issue_date": r.issue_date,
                          "subject": r.subject, "status": self.gr_status(n).value})
        nodes.sort(key=lambda x: (x["issue_date"] is None, x["issue_date"]))
        edges = [e for e in self.edges() if e.source_gr in near and (e.target_gr in near or e.target_gr is None)]
        return {"nodes": nodes, "edges": edges}

    def as_of(self, gr_id: str, on: date) -> list[str]:
        rec = self.corpus.get(gr_id)
        if rec is None:
            raise KeyError(gr_id)
        applied = [e for e in self.edges() if e.target_gr == gr_id and e.rel_type in CHANGING
                   and (s := self.corpus.get(e.source_gr)) and s.issue_date and s.issue_date <= on]
        if any(e.rel_type == RelType.SUPERSEDES and e.scope == Scope.WHOLE for e in applied):
            return []
        return [c.chunk_id for c in rec.chunks
                if not any(self._hits(e, c.clause_label) and e.scope != Scope.WHOLE for e in applied)]
