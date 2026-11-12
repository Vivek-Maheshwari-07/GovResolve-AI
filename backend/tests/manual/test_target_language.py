"""
Test bilingual target language selection for synthesis and guardrails.
Run: python backend/tests/manual/test_target_language.py
"""
import sys
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.models import (
    GRRecord, PageRecord, TextBlock, Chunk, BoundingBox,
    Language, SourceType, ClauseStatus, AnswerStatus, InsufficientReason
)
from backend.rag.search_engine import GRIndex, RAGPipeline
from backend.lineage.lineage_graph import LineageGraph


def make_test_gr():
    text = "Officers are entitled to 30 days of earned leave per year as per Secretariat rules."
    block = TextBlock(
        block_id="TEST-01_b0",
        text=text,
        text_clean=text,
        bbox=BoundingBox(x0=0, y0=0, x1=500, y1=100, page=1),
    )
    page = PageRecord(page_number=1, source_type=SourceType.DIGITAL, blocks=[block])
    chunk = Chunk(
        chunk_id="TEST-01_p1_c000",
        gr_id="TEST-01",
        text=text,
        text_clean=text,
        pages=[1],
        bboxes=[block.bbox],
        chunk_type="paragraph",
        clause_status=ClauseStatus.ACTIVE,
    )
    return GRRecord(
        gr_id="TEST-01",
        gr_number="GAD/TEST/2022/01",
        department="General Administration Department",
        issue_date="2022-01-01",
        subject="Earned Leave Rules",
        language=Language.EN,
        source_type=SourceType.DIGITAL,
        file_path="./data/grs/TEST-01.pdf",
        pages=[page],
        chunks=[chunk],
        raw_text=text,
    )


def test_target_language():
    gr = make_test_gr()
    graph = LineageGraph()
    graph.build([gr])

    index = GRIndex(persist_dir="./data/index/chroma_target_test")
    index.build([gr])

    pipeline = RAGPipeline(index, [gr], lineage_graph=graph)

    # 1. Guardrail out-of-scope in Gujarati
    resp_oos_gu = pipeline.answer("Can I sue the government?", target_language="gu")
    assert resp_oos_gu.answer_status == AnswerStatus.INSUFFICIENT
    assert resp_oos_gu.insufficient_reason == InsufficientReason.OUT_OF_SCOPE
    assert "કાનૂની સલાહ" in resp_oos_gu.summary
    print("✓ Out-of-scope in Gujarati returns Gujarati summary")

    # 2. Guardrail out-of-scope in English
    resp_oos_en = pipeline.answer("Can I sue the government?", target_language="en")
    assert "legal advice" in resp_oos_en.summary
    print("✓ Out-of-scope in English returns English summary")

    # 3. Guardrail too-vague in Gujarati
    resp_vague_gu = pipeline.answer("Leave", target_language="gu")
    assert resp_vague_gu.answer_status == AnswerStatus.INSUFFICIENT
    assert resp_vague_gu.insufficient_reason == InsufficientReason.TOO_VAGUE
    assert any("઀" <= ch <= "૿" for ch in resp_vague_gu.summary)
    assert any("઀" <= ch <= "૿" for ch in (resp_vague_gu.follow_up_question or ""))
    print("✓ Too-vague in Gujarati returns Gujarati summary and follow-up")

    # 4. No document in Gujarati
    resp_nodoc_gu = pipeline.answer("completely nonexistent topic xyz12345", target_language="gu")
    assert resp_nodoc_gu.answer_status == AnswerStatus.INSUFFICIENT
    assert resp_nodoc_gu.insufficient_reason == InsufficientReason.NO_DOCUMENT
    assert any("઀" <= ch <= "૿" for ch in resp_nodoc_gu.summary)
    print("✓ No document in Gujarati returns Gujarati refusal")

    # 5. Answer in Gujarati
    resp_ans_gu = pipeline.answer("How many days of earned leave?", target_language="gu")
    assert resp_ans_gu.citations is not None
    print(f"✓ Answer with target_language='gu': citations={len(resp_ans_gu.citations)}")

    print("\nALL TARGET LANGUAGE TESTS PASSED ✓")


if __name__ == "__main__":
    test_target_language()
