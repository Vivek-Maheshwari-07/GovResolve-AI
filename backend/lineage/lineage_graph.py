"""
Squad 3 — Lineage Graph Builder
Detects amendment/supersession relationships between GRs,
builds a directed graph, and provides clause-level status.

Strategy:
  1. Regex pass on each chunk (fast, high-precision for explicit references)
  2. LLM fallback for implicit references (lower confidence)
  3. Build NetworkX directed graph
  4. Compute clause status via graph traversal
  5. Detect loops/conflicts
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Optional

import networkx as nx
from loguru import logger

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from backend.models import (
    ClauseStatus, GRRecord, LineageEdge, LineageType, LinkConfidence,
)

# ── Phrase patterns loaded from config/glossary.yaml ──────────────
import yaml

_GLOSSARY_PATH = Path(__file__).parent.parent.parent / "config" / "glossary.yaml"


def load_lineage_phrases() -> dict:
    if _GLOSSARY_PATH.exists():
        with open(_GLOSSARY_PATH, encoding="utf-8") as f:
            g = yaml.safe_load(f)
        return g.get("lineage_phrases", {})
    return {}


LINEAGE_PHRASES = load_lineage_phrases()

# GR number reference patterns
GR_REF_PATTERNS = [
    r"(?:GR\s*No\.?|ક્રમાંક|Resolution\s*No\.?|Order\s*No\.?|No\.?)\s*[:\-]?\s*([A-Za-zઅ-ૠ0-9]+[\/\-][\w\/\-]+)",
    r"\b([A-Za-zઅ-ૠ]{2,10}[\/\-]\d{4}[\/\-][\w\/\-]+)\b",
    r"(?:dated?|તા\.)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})",
    r"(\d{1,2}\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4})",
]

SCOPE_PATTERNS = [
    (r"para(?:graph)?\s*([\d\.]+)", "para"),
    (r"clause\s*([\d\.a-z\(\)]+)", "clause"),
    (r"sub-?clause\s*([\d\.a-z\(\)]+)", "sub-clause"),
    (r"schedule\s*([IVX\d]+)", "schedule"),
    (r"annexure\s*([IVX\d]+)", "annexure"),
    (r"whole\s*(?:GR|resolution)", "whole_gr"),
]


# ──────────────────────────────────────────────
# Regex-based relationship detector
# ──────────────────────────────────────────────

def build_phrase_regex(phrases: list[str]) -> re.Pattern:
    escaped = [re.escape(p) for p in phrases]
    pattern = "|".join(escaped)
    return re.compile(pattern, re.IGNORECASE)


_COMPILED: dict[LineageType, re.Pattern] = {}


def _get_compiled(ltype: LineageType) -> Optional[re.Pattern]:
    if ltype in _COMPILED:
        return _COMPILED[ltype]
    key = ltype.value.lower()
    if key == "substitutes":
        key = "substitutes"  # map
    phrases = []
    if key in LINEAGE_PHRASES:
        phrases += LINEAGE_PHRASES[key].get("english", [])
        phrases += LINEAGE_PHRASES[key].get("gujarati", [])
    if not phrases:
        return None
    pat = build_phrase_regex(phrases)
    _COMPILED[ltype] = pat
    return pat


def detect_relationship_in_text(text: str) -> Optional[LineageType]:
    """Return the first lineage type whose trigger phrases appear in text."""
    for ltype in [
        LineageType.SUPERSEDES,
        LineageType.CANCELS,
        LineageType.AMENDS,
        LineageType.SUBSTITUTES,
        LineageType.CLARIFIES,
        LineageType.REFERS,
    ]:
        pat = _get_compiled(ltype)
        if pat and pat.search(text):
            return ltype
    return None


def extract_gr_references(text: str, known_records: Optional[dict[str, GRRecord]] = None) -> list[str]:
    """Extract mentioned GR numbers / dates from text."""
    refs = []
    if known_records:
        for gid, r in known_records.items():
            if r.gr_number and r.gr_number in text:
                refs.append(r.gr_number)
            elif gid in text:
                refs.append(gid)

    for pat in GR_REF_PATTERNS:
        for m in re.finditer(pat, text, re.IGNORECASE):
            match_str = m.group(1).strip()
            if match_str not in refs:
                refs.append(match_str)
    return refs


def extract_scope(text: str) -> str:
    """Determine scope of the relationship (whole GR, para, clause …)."""
    for pat, label in SCOPE_PATTERNS:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return f"{label} {m.group(1)}"
    return "whole_gr"


def extract_sentence_containing(text: str, phrase_pat: re.Pattern) -> str:
    """Return the sentence containing the trigger phrase."""
    sentences = re.split(r"[।\.\!\?]\s+", text)
    for s in sentences:
        if phrase_pat.search(s):
            return s.strip()[:300]
    return text[:300]


def find_matching_gr(
    ref: str,
    all_records: dict[str, GRRecord],
) -> tuple[Optional[str], LinkConfidence]:
    """Match a raw reference string to a GR in the collection."""
    # Exact GR number match
    for gid, rec in all_records.items():
        if rec.gr_number and ref.strip() in rec.gr_number:
            return gid, LinkConfidence.EXPLICIT
    # Date match (probable)
    if re.search(r"\d{4}", ref):
        year = re.search(r"\d{4}", ref).group()
        candidates = [
            gid for gid, rec in all_records.items()
            if rec.issue_date and year in rec.issue_date
        ]
        if len(candidates) == 1:
            return candidates[0], LinkConfidence.PROBABLE
    return None, LinkConfidence.UNKNOWN


# ──────────────────────────────────────────────
# Build the lineage graph
# ──────────────────────────────────────────────

class LineageGraph:
    def __init__(self):
        self.G = nx.DiGraph()   # nodes=gr_id, edges have LineageEdge data

    def build(self, records: list[GRRecord]) -> None:
        """Scan all GR chunks for relationship phrases; populate graph."""
        rec_map = {r.gr_id: r for r in records}

        for rec in records:
            self.G.add_node(rec.gr_id, gr_number=rec.gr_number, issue_date=rec.issue_date)

        for rec in records:
            full_text = rec.raw_text
            ltype = detect_relationship_in_text(full_text)
            if not ltype:
                continue

            refs = extract_gr_references(full_text, rec_map)
            scope = extract_scope(full_text)

            # Get trigger phrase for proof
            pat = _get_compiled(ltype)
            proof = extract_sentence_containing(full_text, pat) if pat else ""

            if refs:
                for ref in refs:
                    target_id, conf = find_matching_gr(ref, rec_map)
                    edge = LineageEdge(
                        from_gr_id=rec.gr_id,
                        to_gr_id=target_id,
                        to_gr_number=ref,
                        link_type=ltype,
                        scope=scope,
                        proof_text=proof,
                        proof_page=1,
                        confidence=conf,
                    )
                    rec.references.append(edge)
                    if target_id:
                        self.G.add_edge(
                            rec.gr_id, target_id,
                            edge_data=edge.model_dump(),
                        )
                    else:
                        # BROKEN_CHAIN node
                        broken_id = f"BROKEN::{ref}"
                        self.G.add_node(broken_id, gr_number=ref, issue_date=None, broken=True)
                        self.G.add_edge(rec.gr_id, broken_id, edge_data=edge.model_dump())
            else:
                # No explicit reference found — generic link to same-subject GRs
                proof_text = proof or full_text[:200]
                edge = LineageEdge(
                    from_gr_id=rec.gr_id,
                    to_gr_id=None,
                    to_gr_number=None,
                    link_type=ltype,
                    scope=scope,
                    proof_text=proof_text,
                    proof_page=1,
                    confidence=LinkConfidence.UNKNOWN,
                )
                rec.references.append(edge)

        logger.info(
            f"Lineage graph: {self.G.number_of_nodes()} nodes, "
            f"{self.G.number_of_edges()} edges"
        )
        self._detect_loops()

    def _detect_loops(self) -> None:
        try:
            cycle = nx.find_cycle(self.G)
            logger.warning(f"Loop detected in lineage graph: {cycle}")
        except nx.NetworkXNoCycle:
            pass

    def get_clause_status(self, gr_id: str) -> ClauseStatus:
        """
        Walk forward in the graph from gr_id.
        - SUPERSEDED if any successor has a SUPERSEDES edge to it
        - AMENDED if any successor has an AMENDS/SUBSTITUTES edge to it
        - ABROGATED if CANCELS edge
        - ACTIVE if no successors affecting this GR
        """
        if gr_id not in self.G:
            return ClauseStatus.UNKNOWN

        predecessors_edges = list(self.G.in_edges(gr_id, data=True))
        if not predecessors_edges:
            return ClauseStatus.ACTIVE  # nothing points to it (amending it)

        statuses = set()
        for _, _, data in predecessors_edges:
            ed = data.get("edge_data", {})
            ltype = ed.get("link_type", "")
            if ltype == LineageType.SUPERSEDES:
                statuses.add(ClauseStatus.SUPERSEDED)
            elif ltype == LineageType.CANCELS:
                statuses.add(ClauseStatus.ABROGATED)
            elif ltype in (LineageType.AMENDS, LineageType.SUBSTITUTES):
                statuses.add(ClauseStatus.AMENDED)

        if ClauseStatus.SUPERSEDED in statuses:
            return ClauseStatus.SUPERSEDED
        if ClauseStatus.ABROGATED in statuses:
            return ClauseStatus.ABROGATED
        if ClauseStatus.AMENDED in statuses:
            return ClauseStatus.AMENDED
        return ClauseStatus.ACTIVE

    def get_chain(self, gr_id: str, max_depth: int = 10) -> list[str]:
        """Return the full chain of GRs from oldest to latest."""
        if gr_id not in self.G:
            return [gr_id]
        try:
            # Successors = GRs that THIS gr_id supersedes/amends
            # Predecessors = GRs that supersede/amend THIS gr_id
            ancestors = list(nx.ancestors(self.G, gr_id))
            return sorted(
                ancestors + [gr_id],
                key=lambda g: self.G.nodes[g].get("issue_date") or "",
            )
        except Exception:
            return [gr_id]

    def get_latest_version(self, gr_id: str) -> str:
        """Follow SUPERSEDES/AMENDS chain to the most recent GR."""
        visited = set()
        current = gr_id
        while current not in visited:
            visited.add(current)
            successors = [
                (nbr, d["edge_data"])
                for _, nbr, d in self.G.out_edges(current, data=True)
                if d.get("edge_data", {}).get("link_type") in (
                    LineageType.SUPERSEDES, LineageType.AMENDS
                )
            ]
            if not successors:
                break
            # pick the one with latest date
            successors.sort(
                key=lambda x: self.G.nodes[x[0]].get("issue_date") or "",
                reverse=True,
            )
            current = successors[0][0]
        return current

    def save(self, path: str) -> None:
        data = nx.node_link_data(self.G)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Lineage graph saved → {path}")

    @classmethod
    def load(cls, path: str) -> "LineageGraph":
        lg = cls()
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        lg.G = nx.node_link_graph(data, directed=True)
        return lg


# ──────────────────────────────────────────────
# Update chunk statuses across all records
# ──────────────────────────────────────────────

def apply_lineage_to_records(
    records: list[GRRecord],
    graph: LineageGraph,
) -> None:
    """Update clause_status on every chunk using graph traversal."""
    for rec in records:
        gr_status = graph.get_clause_status(rec.gr_id)
        for chunk in rec.chunks:
            # Default: inherit GR-level status
            chunk.clause_status = gr_status


if __name__ == "__main__":
    import glob

    processed_dir = Path("./data/processed")
    records = []
    for jf in processed_dir.glob("*.json"):
        with open(jf, encoding="utf-8") as f:
            records.append(GRRecord.model_validate_json(f.read()))

    graph = LineageGraph()
    graph.build(records)
    apply_lineage_to_records(records, graph)

    graph.save("./data/index/lineage_graph.json")
    logger.success(f"Built lineage graph for {len(records)} GRs.")

