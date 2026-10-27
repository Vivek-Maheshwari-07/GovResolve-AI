"""Step 6b: clause status, and the mapping to the five answer statuses (plan section 4.7)."""
from collections import defaultdict
from datetime import date

from ..schemas import (
    CLAUSE_TO_ANSWER, ChunkLineage, ClauseStatus, Confidence, LineageEdge, RelType, Scope,
)
from ..store.corpus import Corpus
from .graph import LineageGraph, edge_date
from .patterns import CHANGING
from .scope import label_matches

POOR_SCAN_BELOW = 0.5


def edge_hits(e: LineageEdge, label: str | None) -> bool:
    """Does this edge touch the clause with this label? Whole-GR and unknown-scope edges touch all."""
    if e.scope in (Scope.WHOLE, Scope.UNKNOWN) or not e.target_clauses:
        return True
    return label_matches(label, e.target_clauses)


class StatusEngine:
    def __init__(self, corpus: Corpus, graph: LineageGraph):
        self.corpus, self.graph = corpus, graph

    def chunk(self, chunk_id: str) -> ChunkLineage:
        gr_id = self.corpus.gr_of_chunk(chunk_id)
        chunk = self.corpus.chunk(chunk_id)
        if gr_id is None or chunk is None:
            raise KeyError(chunk_id)
        return self._status(gr_id, chunk.clause_label, chunk_id)

    def gr(self, gr_id: str) -> ClauseStatus:
        rec = self.corpus.get(gr_id)
        if rec is None:
            raise KeyError(gr_id)
        found = {self._status(gr_id, c.clause_label, c.chunk_id).status for c in rec.chunks}
        if not found:
            return self._status(gr_id, None, "").status
        if ClauseStatus.CONFLICT in found:
            return ClauseStatus.CONFLICT
        if ClauseStatus.UNKNOWN in found:
            return ClauseStatus.UNKNOWN
        if len(found) == 1:
            return next(iter(found))
        if found <= {ClauseStatus.SUPERSEDED, ClauseStatus.ABROGATED}:
            return ClauseStatus.SUPERSEDED if ClauseStatus.SUPERSEDED in found else ClauseStatus.ABROGATED
        return ClauseStatus.AMENDED  # mixed: some clauses changed, others still active

    def _status(self, gr_id: str, label: str | None, chunk_id: str) -> ChunkLineage:
        rec = self.corpus.get(gr_id)
        out = ChunkLineage(chunk_id=chunk_id, gr_id=gr_id)

        def done(status: ClauseStatus, reason: str | None = None) -> ChunkLineage:
            out.status, out.reason_code = status, reason
            out.answer_status = CLAUSE_TO_ANSWER[status]
            return out

        conf = rec.field_confidence.get("text") if rec else None
        if conf is not None and conf < POOR_SCAN_BELOW:
            out.warnings.append("Scan quality is too poor to rely on lineage for this GR.")
            return done(ClauseStatus.UNKNOWN, "POOR_SCAN")
        if gr_id in self.graph.cycle_nodes:
            out.warnings.append("This GR is part of a circular chain of amendments; needs human review.")
            return done(ClauseStatus.CONFLICT, "CYCLE")

        incoming = [e for e in self.graph.incoming.get(gr_id, []) if edge_hits(e, label)]
        restores = [e for e in incoming if e.rel_type == RelType.RESTORES and e.confidence == Confidence.EXPLICIT]
        if restores:  # a later restoration cancels earlier cancellations / supersessions
            latest = max(edge_date(e, self.corpus) for e in restores)
            incoming = [e for e in incoming if e.rel_type == RelType.RESTORES or edge_date(e, self.corpus) >= latest]
            out.warnings.append("Restored by " + ", ".join(sorted({e.source_gr for e in restores})) + ".")
        out.changed_by = sorted(incoming, key=lambda e: edge_date(e, self.corpus))
        changing = [e for e in incoming if e.rel_type in CHANGING and e.rel_type != RelType.RESTORES]
        explicit = [e for e in changing if e.confidence == Confidence.EXPLICIT]

        strong = [e for e in explicit if e.rel_type in (RelType.SUPERSEDES, RelType.CANCELS) and e.scope != Scope.UNKNOWN]
        if strong:
            last = max(strong, key=lambda e: (edge_date(e, self.corpus), e.rel_type == RelType.CANCELS))
            if last.rel_type == RelType.CANCELS:
                out.warnings.append(f"Cancelled by {last.source_gr} with no replacement named.")
                return done(ClauseStatus.ABROGATED)
            self._fill_latest(out, gr_id, label)
            return done(ClauseStatus.SUPERSEDED)

        by_date = defaultdict(set)
        for e in explicit:
            by_date[edge_date(e, self.corpus)].add(e.source_gr)
        if any(len(srcs) > 1 for srcs in by_date.values()):
            out.warnings.append("Two different GRs change this clause on the same date.")
            return done(ClauseStatus.CONFLICT, "SAME_DATE")
        if explicit:
            return done(ClauseStatus.AMENDED)
        if changing:
            out.warnings.append("A possible later change was found but could not be confirmed.")
            return done(ClauseStatus.AMENDED, "PROBABLE_ONLY")
        for e in incoming:
            if e.rel_type == RelType.CLARIFIES:
                out.warnings.append(f"Clarified by {e.source_gr}.")
        return done(ClauseStatus.ACTIVE)

    def _fill_latest(self, out: ChunkLineage, gr_id: str, label: str | None) -> None:
        path, hit_limit = self.graph.forward_chain(gr_id, self.corpus)
        if not path:
            return
        latest = path[-1]
        out.latest_gr_ids = [latest]
        rec = self.corpus.get(latest)
        if rec:
            same = [c.chunk_id for c in rec.chunks if label and c.clause_label == label]
            out.latest_chunk_ids = same or [c.chunk_id for c in rec.chunks if c.section != "read"]
        if self.graph.cycle_nodes & set(path):
            out.warnings.append("The chain of replacements loops back on itself.")
        if hit_limit:
            out.warnings.append("Replacement chain is longer than 10 steps; the newest version may be later.")
        if any(e.rel_type == RelType.CANCELS and e.confidence == Confidence.EXPLICIT and e.scope != Scope.UNKNOWN
               for e in self.graph.incoming.get(latest, [])):
            out.warnings.append(f"The latest replacement {latest} has itself been cancelled.")


def in_force_on(corpus: Corpus, edges: list[LineageEdge], gr_id: str, on: date) -> list[str]:
    """Chunk ids of gr_id still operative on `on`, using only changes that took effect by then."""
    rec = corpus.get(gr_id)
    if rec is None:
        raise KeyError(gr_id)
    if rec.issue_date and rec.issue_date > on:
        return []
    engine = StatusEngine(corpus, LineageGraph([e for e in edges if edge_date(e, corpus) <= on]))
    gone = {ClauseStatus.SUPERSEDED, ClauseStatus.ABROGATED}
    return [c.chunk_id for c in rec.chunks if engine.chunk(c.chunk_id).status not in gone]
