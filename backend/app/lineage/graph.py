"""Step 6a: the lineage graph. Nodes are GRs; edges point from the newer GR to the older GR it changes."""
from collections import deque
from datetime import date

import networkx as nx

from ..schemas import Confidence, LineageEdge, RelType, Scope
from ..store.corpus import Corpus
from .patterns import CHANGING

MAX_HOPS = 10
TIMELINE_RELS = CHANGING | {RelType.CLARIFIES}


def edge_date(e: LineageEdge, corpus: Corpus) -> date:
    """When the change takes effect: w.e.f. date if stated, else the issuing GR's date."""
    if e.effective_date:
        return e.effective_date
    src = corpus.get(e.source_gr)
    return (src.issue_date if src else None) or date.min


class LineageGraph:
    def __init__(self, edges: list[LineageEdge]):
        self.edges = edges
        self.g = nx.MultiDiGraph()
        self.incoming: dict[str, list[LineageEdge]] = {}
        for e in edges:
            if e.target_gr:
                self.g.add_edge(e.source_gr, e.target_gr, key=e.edge_id, edge=e)
                self.incoming.setdefault(e.target_gr, []).append(e)
        flat = nx.DiGraph()
        flat.add_edges_from((e.source_gr, e.target_gr) for e in edges if e.target_gr and e.rel_type in CHANGING)
        self._cycles = [c for c in nx.simple_cycles(flat)]
        self.cycle_nodes = {n for c in self._cycles for n in c}

    def cycles(self) -> list[list[str]]:
        return self._cycles

    def neighbourhood(self, gr_id: str, hops: int) -> set[str]:
        """GRs within `hops` of gr_id, walking change/clarify edges in both directions."""
        seen, queue = {gr_id}, deque([(gr_id, 0)])
        while queue:
            node, d = queue.popleft()
            if d >= hops or node not in self.g:
                continue
            adj = [(v, k) for _, v, k, dt in self.g.out_edges(node, keys=True, data=True)]
            adj += [(u, k) for u, _, k, dt in self.g.in_edges(node, keys=True, data=True)]
            for other, key in adj:
                edge = next(e for e in self.edges if e.edge_id == key)
                if edge.rel_type in TIMELINE_RELS and other not in seen:
                    seen.add(other)
                    queue.append((other, d + 1))
        return seen

    def forward_chain(self, gr_id: str, corpus: Corpus) -> tuple[list[str], bool]:
        """Follow whole-GR supersessions to the newest version. (path after gr_id, hit the hop limit)."""
        path, seen, cur = [], {gr_id}, gr_id
        for _ in range(MAX_HOPS):
            nxt = [e for e in self.incoming.get(cur, [])
                   if e.rel_type == RelType.SUPERSEDES and e.confidence == Confidence.EXPLICIT
                   and e.scope != Scope.UNKNOWN and e.source_gr not in seen]
            if not nxt:
                return path, False
            cur = max(nxt, key=lambda e: edge_date(e, corpus)).source_gr
            path.append(cur)
            seen.add(cur)
        return path, True
