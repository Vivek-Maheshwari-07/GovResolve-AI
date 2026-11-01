"""LineageService: the one interface Member B's API calls (plan section 2.1)."""
import hashlib
from datetime import date

from ..schemas import ChunkLineage, ClauseStatus, Confidence, LineageEdge, RelType, Scope
from ..store.corpus import Corpus
from .extract import Candidate, Refs, extract_gr, extract_refs
from .graph import LineageGraph, edge_date
from .llm_fallback import Cache, LLMFallback
from .normalize import normalize_text
from .resolve import Resolver, Target
from .scope import parse_scope
from .status import StatusEngine, in_force_on


class LineageService:
    def __init__(self, corpus: Corpus, llm: LLMFallback | None = None, cache: Cache | None = None):
        self.corpus = corpus
        self.llm = llm
        self.cache = cache
        self.review_items: list[dict] = []  # sentences nobody could turn into an edge
        self._detected: list[LineageEdge] = []
        self._added: list[LineageEdge] = []
        self._removed: set[str] = set()
        self._graph: LineageGraph | None = None
        self._engine: StatusEngine | None = None
        self._status_cache: dict[str, ChunkLineage] = {}
        self.build()

    # ---- build: steps 1-6 ----
    def build(self) -> None:
        resolver = Resolver(self.corpus)
        edges: list[LineageEdge] = []
        self.review_items = []
        for gr in sorted(self.corpus.grs.values(), key=lambda g: (g.issue_date is None, g.issue_date, g.gr_id)):
            ex = extract_gr(gr, resolver.departments, resolver.match_title)
            self.review_items += ex.review
            for item in ex.read_items:  # references in the Read list are REFERS only
                refs = extract_refs(normalize_text(item.text), set(), gr.issue_date, resolver.departments)
                for t in resolver.resolve(refs, gr, []):
                    edges.append(self._edge(gr.gr_id, item.chunk_id, t, RelType.REFERS, Scope.WHOLE, [],
                                            f"Read ({item.number}): {item.text}", "regex", None))
            for cand in ex.candidates:
                edges += self._candidate_edges(cand, gr, resolver, ex.read_items)
        self._detected = self._dedupe(edges)
        self._refresh()

    def _candidate_edges(self, cand: Candidate, gr, resolver: Resolver, read_items) -> list[LineageEdge]:
        method, rel, scope, clauses, refs = "regex", cand.rel, cand.scope, cand.clauses, cand.refs
        llm_cap = False
        if rel is None:  # a reference with no phrase: ask the LLM if there is one, else flag for review
            guess = self.llm.classify(cand.sentence, cand.before, cand.after,
                                      [f"({i.number}) {i.text}" for i in read_items]) if self.llm else None
            if guess is None or guess.rel_type is None:
                if self.llm is None:
                    self.review_items.append({"gr_id": gr.gr_id, "chunk_id": cand.chunk_id,
                                              "kind": "reference_without_phrase", "sentence": cand.sentence})
                return []
            method, rel, scope, clauses, llm_cap = "llm", guess.rel_type, guess.scope, guess.target_clauses, True
            if guess.target_ref_text:
                refs = extract_refs(normalize_text(guess.target_ref_text), set(), gr.issue_date,
                                    resolver.departments)
                refs.dept_hints = cand.refs.dept_hints
                refs.pointers = refs.pointers or cand.refs.pointers
        targets = resolver.resolve(refs, gr, read_items) if (refs.numbers or refs.dates or refs.pointers or refs.titles) else []
        if cand.refs.blanket and not any(t.gr_id for t in targets):
            targets = resolver.blanket(gr) or targets
        if not targets:
            self.review_items.append({"gr_id": gr.gr_id, "chunk_id": cand.chunk_id, "kind": "no_usable_target",
                                      "sentence": cand.sentence})
            return []
        out = []
        for t in targets:
            target = self.corpus.get(t.gr_id) if t.gr_id else None
            if target and target.issue_date and gr.issue_date and target.issue_date > gr.issue_date:
                self.review_items.append({"gr_id": gr.gr_id, "chunk_id": cand.chunk_id, "kind": "target_is_newer",
                                          "sentence": cand.sentence})
                continue
            if llm_cap and t.gr_id and "gr number" not in t.note:  # LLM edges stay PROBABLE unless the number matched
                t = Target(t.gr_id, Confidence.PROBABLE, t.ref_text, t.note)
            out.append(self._edge(gr.gr_id, cand.chunk_id, t, rel, scope, clauses, cand.sentence, method,
                                  refs.eff_date or gr.effective_date))
        return out

    @staticmethod
    def _edge(source: str, chunk_id: str, t: Target, rel: RelType, scope: Scope, clauses: list[str],
              evidence: str, method: str, eff: date | None) -> LineageEdge:
        key = "|".join([source, t.gr_id or "", rel.value, ",".join(clauses), t.ref_text])
        return LineageEdge(
            edge_id="E" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10],
            source_gr=source, target_gr=t.gr_id, rel_type=rel,
            confidence=t.confidence or (Confidence.EXPLICIT if t.note == "not in corpus" else Confidence.PROBABLE),
            method=method, scope=scope, target_clauses=clauses, target_ref_text=t.ref_text,
            evidence_text=evidence[:400], evidence_chunk_id=chunk_id, effective_date=eff,
        )

    @staticmethod
    def _dedupe(edges: list[LineageEdge]) -> list[LineageEdge]:
        seen: dict[str, LineageEdge] = {}
        for e in edges:
            seen.setdefault(e.edge_id, e)
        return list(seen.values())

    def _refresh(self) -> None:
        self._graph = LineageGraph(self.edges())
        self._engine = StatusEngine(self.corpus, self._graph)
        self._status_cache = {}

    # ---- the interface ----
    def apply_overrides(self, added: list[LineageEdge], removed: list[str]) -> None:
        self._added, self._removed = list(added), set(removed)
        self._refresh()

    def edges(self) -> list[LineageEdge]:
        by_id = {e.edge_id: e for e in self._detected if e.edge_id not in self._removed}
        by_id.update({e.edge_id: e for e in self._added})
        return list(by_id.values())

    def broken_links(self) -> list[LineageEdge]:
        return [e for e in self.edges() if e.target_gr is None]

    def cycles(self) -> list[list[str]]:
        return self._graph.cycles()

    def chunk_status(self, chunk_id: str) -> ChunkLineage:
        if chunk_id not in self._status_cache:
            self._status_cache[chunk_id] = self._engine.chunk(chunk_id)
        return self._status_cache[chunk_id]

    def gr_status(self, gr_id: str) -> ClauseStatus:
        return self._engine.gr(gr_id)

    def timeline(self, gr_id: str, hops: int = 5) -> dict:
        if self.corpus.get(gr_id) is None:
            raise KeyError(gr_id)
        near = self._graph.neighbourhood(gr_id, hops)
        nodes = []
        for n in near:
            r = self.corpus.get(n)
            if r:
                nodes.append({"gr_id": n, "gr_number": r.gr_number, "department": r.department,
                              "issue_date": r.issue_date, "subject": r.subject, "status": self.gr_status(n).value})
        nodes.sort(key=lambda x: (x["issue_date"] is None, x["issue_date"], x["gr_id"]))
        edges = [e for e in self.edges() if e.source_gr in near and (e.target_gr in near or e.target_gr is None)]
        edges.sort(key=lambda e: edge_date(e, self.corpus))
        return {"nodes": nodes, "edges": edges}

    def as_of(self, gr_id: str, on: date) -> list[str]:
        return in_force_on(self.corpus, self.edges(), gr_id, on)
