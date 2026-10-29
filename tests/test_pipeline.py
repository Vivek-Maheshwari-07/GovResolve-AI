"""
Quick end-to-end smoke test using a synthetic in-memory GR (no real PDFs needed).
Run: python tests/test_pipeline.py
"""
import sys
import os
# Force UTF-8 output on Windows
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.models import (
    GRRecord, PageRecord, TextBlock, Chunk, BoundingBox,
    Language, SourceType, ClauseStatus
)
from backend.rag.search_engine import (
    GRIndex, RAGPipeline,
    is_out_of_scope, is_too_vague,
    verify_citation
)
from backend.lineage.lineage_graph import LineageGraph


def make_fake_gr(gr_id: str, gr_number: str, subject: str, text: str, date: str) -> GRRecord:
    block = TextBlock(
        block_id=f"{gr_id}_b0",
        text=text,
        text_clean=text,
        bbox=BoundingBox(x0=0, y0=0, x1=500, y1=100, page=1),
    )
    page = PageRecord(page_number=1, source_type=SourceType.DIGITAL, blocks=[block])
    chunk = Chunk(
        chunk_id=f"{gr_id}_p1_c000",
        gr_id=gr_id,
        text=text,
        text_clean=text,
        pages=[1],
        bboxes=[block.bbox],
        chunk_type="paragraph",
        clause_status=ClauseStatus.ACTIVE,
    )
    return GRRecord(
        gr_id=gr_id,
        gr_number=gr_number,
        department="General Administration Department",
        issue_date=date,
        subject=subject,
        language=Language.EN,
        source_type=SourceType.DIGITAL,
        file_path=f"./data/grs/{gr_id}.pdf",
        pages=[page],
        chunks=[chunk],
        raw_text=text,
    )


def run_tests():
    print("=" * 60)
    print("GovResolve-AI — Smoke Tests")
    print("=" * 60)

    # ── Test 1: Gujlish & Secretariat Normalization (Pillar 1) ──
    from backend.rag.gujlish_normalizer import GujlishNormalizer
    norm = GujlishNormalizer()
    assert norm.detect_language("hello world") == "en"
    assert norm.detect_language("પ્રસૂતિ રજા") == "gu"
    assert norm.detect_language("maternity leave mate kya joie") == "gujlish"
    assert norm.detect_language("refund leva mate su karvu pade?") == "gujlish"

    bundle = norm.normalize("refund leva mate su karvu pade?")
    assert "refund" in bundle.keywords or "રીફંડ" in bundle.query_gu
    assert len(bundle.query_gu) > 0 and len(bundle.query_en) > 0
    print("✓ T1: Gujlish detection & bilingual search bundle")

    # ── Test 2: Guard rails ─────────────────────────────────────
    assert is_out_of_scope("Can I sue the department?") is True
    assert is_out_of_scope("How many days is casual leave?") is False
    assert is_too_vague("Leave") is True
    assert is_too_vague("How many days of casual leave for Class-I officers?") is False
    print("✓ T2: Guard rails (out-of-scope, vague)")

    # ── Test 3: Citation verifier & Gujarati Stemmer (Pillar 2) ─
    page_text = "Officers are entitled to 30 days of earned leave per year as per para 3."
    assert verify_citation("30 days of earned leave", page_text) is True
    assert verify_citation("15 days of casual leave", page_text) is False

    from backend.rag.gujarati_stemmer import stem_gujarati_word, tokenize_for_bm25
    assert stem_gujarati_word("ઠરાવમાં") == "ઠરાવ"
    assert stem_gujarati_word("નિયમો") == "નિયમ"
    tokens = tokenize_for_bm25("આ ઠરાવમાં સરકારી નિયમો મુજબ ૧૮૦ દિવસ")
    assert "ઠરાવ" in tokens
    assert "નિયમ" in tokens
    assert "180" in tokens
    print("✓ T3: Citation verifier & Gujarati suffix stripper (BM25)")

    # ── Test 4: Gujarati digit normalisation ────────────────────
    from backend.ingestion.ingest import normalise_gujarati_digits
    assert normalise_gujarati_digits("૧૦ days ૨૦") == "10 days 20"
    print("✓ T4: Gujarati digit normalisation")

    # ── Test 5: Lineage graph with fake records ─────────────────
    gr_old = make_fake_gr("GAD-2014-0001", "GAD/2014/001", "Leave Rules",
        "Officers are entitled to 30 days earned leave per year.", "2014-01-15")
    gr_new = make_fake_gr("GAD-2021-0001", "GAD/2021/001", "Leave Rules Amendment",
        "In supersession of GAD/2014/001, officers are entitled to 28 days earned leave per year.",
        "2021-03-10")

    graph = LineageGraph()
    graph.build([gr_old, gr_new])

    status_old = graph.get_clause_status("GAD-2014-0001")
    status_new = graph.get_clause_status("GAD-2021-0001")
    print(f"  Old GR status: {status_old.value} (expected Superseded)")
    print(f"  New GR status: {status_new.value} (expected Active)")
    assert status_old == ClauseStatus.SUPERSEDED, f"Expected SUPERSEDED, got {status_old}"
    assert status_new == ClauseStatus.ACTIVE, f"Expected ACTIVE, got {status_new}"
    print("✓ T5: Lineage graph detection")

    # ── Test 6: Index build + search ───────────────────────────
    index = GRIndex(persist_dir="./data/index/chroma_test")
    index.build([gr_old, gr_new])
    results = index.search("earned leave days officers", top_k=5)
    assert len(results) > 0, "Search returned no results"
    print(f"✓ T6: Index + search ({len(results)} results for 'earned leave')")

    # ── Test 7: Full pipeline — out-of-scope ────────────────────
    pipeline = RAGPipeline(index, [gr_old, gr_new], lineage_graph=graph)
    resp = pipeline.answer("Can I sue the government for leave rejection?")
    from backend.models import AnswerStatus, InsufficientReason
    assert resp.answer_status == AnswerStatus.INSUFFICIENT
    assert resp.insufficient_reason == InsufficientReason.OUT_OF_SCOPE
    print("✓ T7: Pipeline — OUT_OF_SCOPE refusal")

    # ── Test 8: Full pipeline — answerable ─────────────────────
    resp2 = pipeline.answer("How many days of earned leave per year?")
    print(f"✓ T8: Pipeline — status={resp2.answer_status.value}, "
          f"citations={len(resp2.citations)}")

    print("\n" + "="*60)
    print("ALL SMOKE TESTS PASSED ✓")
    print("="*60)
    print("\nNext steps:")
    print("  1. Add your GR PDFs to ./data/grs/")
    print("  2. Set GOOGLE_API_KEY in .env")
    print("  3. Run: python scripts/add_gr.py --dir ./data/grs/")
    print("  4. Start API: python -m uvicorn backend.api.main:app --reload")
    print("  5. Query: python scripts/add_gr.py --query 'maternity leave documents'")


if __name__ == "__main__":
    run_tests()
