"""Unit tests for shared ingestion metadata/chunking helpers and NVIDIA NIM embeddings."""
from __future__ import annotations

from unittest.mock import MagicMock

import chromadb

from backend.ingestion.metadata import (
    build_complete_chunks,
    extract_department,
    extract_gr_number,
    extract_issue_date,
    extract_subject,
    has_garbled_font_stream,
)
from backend.models import BoundingBox, PageRecord, SourceType, TextBlock
from backend.rag.search_engine import (
    NvidiaEmbeddingFunction,
    select_sentences,
    split_into_sentences,
)


def test_has_garbled_font_stream_detects_shruti_control_bytes():
    corrupted = "પંચવટી યોજનાના\x07\x0f\x02 અમલીકરણ બાબત\x11 ગુજરાત સરકાર"
    mojibake = "Ȥુજરાત સરકાર પર\x8eક્ષાની ુિનવિસ\x90ટ\x8eને"
    clean = "પંચવટી યોજનાના અમલીકરણ બાબત. ગુજરાત સરકાર, પંચાયત વિભાગ."
    assert has_garbled_font_stream(corrupted) is True
    assert has_garbled_font_stream(mojibake) is True
    assert has_garbled_font_stream(clean) is False


def test_extract_issue_date_prefers_header_and_gazette_over_references_and_esign():
    panchvati_like = """પંચવટી યોજનાના અમલીકરણ બાબત
ગુજરાત સરકાર
પંચાયત, ગ્રામ ગૃહનિર્માણ અને ગ્રામ વિકાસ વિભાગ,
ઠરાવ ક્રમાંક: પ્રચવ/૧૦૨૦૦૪/૨૯૩૮/ક
સચિવાલય, ગાંધીનગર.
તારીખ : ૧૧/૦૯/૨૦૦૪
વંચાણે લીધા : (૧) તા. ૧૦/૦૮/૨૦૦૦ નો ઠરાવ.
Signed by: Officer
Date: 14-08-2023"""
    assert extract_issue_date(panchvati_like, "Panchvati_Yojna_11092004.pdf") == "2004-09-11"

    gazette_like = """EXTRAORDINARY
PUBLISHED BY AUTHORITY
Vol. LXV] TUESDAY, OCTOBER 29, 2024 / KARTIKA 7, 1946
GENERAL ADMINISTRATION DEPARTMENT
NOTIFICATION
No.GS/2024/39/GAD"""
    assert extract_issue_date(gazette_like) == "2024-10-29"

    whereas_draft_like = """Panchayats, Rural Housing and Rural Development Department,
Dated the ..............., 2025.
No. KP/13 OF 2025/PRHRDD/mis/e-file/14/2022/1451/Section-J:-WHEREAS certain
draft rules were published dated the 26th December, 2024.
Date: 27-Mar-2025 (01:48 PM)"""
    assert extract_issue_date(whereas_draft_like) == "2025-03-27"

    gad_like = """ગુજરાત સરકાર
સામાન્ય વહીવટ વિભાગ
ઠરાવ ક્રમાંક : સીઆરઆર-૧૦૨૦૧૯-૧૨૩-ગ.૫
તારીખ : ૦૩/૦૮/૨૦૧૯
વંચાણે લીધા : (૧) સા.વ.વિ. નો તા. ૧૯/૦૯/૨૦૦૦ નો ઠરાવ."""
    assert extract_issue_date(gad_like) == "2019-08-03"


def test_extract_gr_number_department_and_subject():
    text = """પંચવટી યોજનાના અમલીકરણ બાબત.
ગુજરાત સરકાર
પંચાયત, ગ્રામ ગૃહનિર્માણ અને ગ્રામ વિકાસ વિભાગ,
ઠરાવ ક્રમાંક : પ્રચવ/૧૦૨૦૦૪/૨૯૩૮/ક
સચિવાલય, ગાંધીનગર
વંચાણે લીધા : (૧) ગ્રામ વિકાસ યોજના"""
    gr_num, conf = extract_gr_number(text)
    assert gr_num == "પ્રચવ/૧૦૨૦૦૪/૨૯૩૮/ક"
    assert conf > 0.8
    assert extract_department(text, current_dept="Finance Department") == (
        "Panchayat, Rural Housing and Rural Development Department"
    )
    assert "પંચવટી યોજનાના અમલીકરણ બાબત" in extract_subject(text)


def test_build_complete_chunks_retains_preamble_clauses_and_footer():
    p1_text = (
        "ગુજરાત સરકાર\nતારીખ : ૧૧/૦૯/૨૦૦૪\n"
        "વંચાણે લીધા : (૧) ગ્રામ વિકાસ ખાતાનો તા. ૧૦/૦૮/૨૦૦૧ નો પરિપત્ર.\n"
        "આમુખ : રાજ્યના ગ્રામીણ વિસ્તારોમાં વૃક્ષારોપણ અને બગીચા વિકસાવવા બાબત "
        + "વિગતવાર આયોજન કરવાની બાબત સરકારશ્રીની વિચારણા હેઠળ હતી.\n"
        "ઠરાવ : ૧. આ યોજના હેઠળ દરેક ગામમાં પંચવટી ઉદ્યાન ઊભું કરવામાં આવશે.\n"
        "૨. ગ્રામ પંચાયતને મહત્તમ રૂ. ૧,૦૦,૦૦૦ ની સહાય મળવાપાત્ર થશે.\n"
        "ગુજરાતના રાજ્યપાલશ્રીના હુકમથી અને તેમના નામે."
    )
    pages = [
        PageRecord(
            page_number=1,
            source_type=SourceType.DIGITAL,
            ocr_confidence=0.99,
            blocks=[
                TextBlock(
                    block_id="p1_b0",
                    text=p1_text,
                    text_clean=p1_text,
                    bbox=BoundingBox(x0=0, y0=0, x1=595, y1=842, page=1),
                )
            ],
        )
    ]
    chunks = build_complete_chunks(
        "FD-0000-8a8a0d",
        pages,
        subject="પંચવટી યોજનાના અમલીકરણ બાબત",
        department="Panchayat, Rural Housing and Rural Development Department",
        gr_number="પ્રચવ/૧૦૨૦૦૪/૨૯૩૮/ક",
        issue_date="2004-09-11",
    )
    combined = "\n".join(c.text for c in chunks)
    assert "વંચાણે લીધા" in combined
    assert "આમુખ" in combined
    assert "૧,૦૦,૦૦૦" in combined
    assert "રાજ્યપાલશ્રીના હુકમથી" in combined
    assert all(c.pages == [1] for c in chunks)


def test_nvidia_embedding_function_passage_vs_query_and_chroma_roundtrip(monkeypatch):
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append((url, headers, json, timeout))
        n = len(json["input"])
        resp = MagicMock()
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {
            "data": [
                {"index": i, "embedding": [float(i + 1), 0.5, 0.25, 0.125]}
                for i in range(n)
            ]
        }
        return resp

    monkeypatch.setattr("backend.rag.search_engine.requests.post", fake_post)

    ef = NvidiaEmbeddingFunction(
        model_name="nvidia/nemotron-3.5-embed-1b",
        api_key="nvapi-test-secret",
        batch_size=2,
    )
    cfg = ef.get_config()
    assert "api_key" not in cfg and "nvapi-test-secret" not in str(cfg)

    passages = ef(["first doc", "second doc", "third doc"])
    assert len(passages) == 3
    assert [c[2]["input_type"] for c in calls] == ["passage", "passage"]
    assert len(calls[0][2]["input"]) == 2
    assert len(calls[1][2]["input"]) == 1
    assert calls[0][1]["Authorization"] == "Bearer nvapi-test-secret"

    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-env-secret")
    rebuilt = NvidiaEmbeddingFunction.build_from_config(cfg)
    qvecs = rebuilt.embed_query(["query text"])
    assert len(qvecs) == 1
    assert calls[-1][2]["input_type"] == "query"
    assert calls[-1][1]["Authorization"] == "Bearer nvapi-env-secret"

    client = chromadb.EphemeralClient()
    col = client.create_collection(name="test_nv", embedding_function=ef)
    col.add(ids=["c1"], documents=["test document"])
    res = col.query(query_texts=["test query"], n_results=1)
    assert res["ids"] == [["c1"]]


def test_split_into_sentences_preserves_gujarati_initials_and_abbreviations():
    text = (
        "(૨) (૧) શ્રી રિધ્ધેશ આર. પાઠક, નિવૃત્ત નાયબ કમિશનર (૨) શ્રીમતી કીર્તિદા વી. બ્રહ્મભટ્ટ, "
        "નિવૃત્ત અધિક સચિવ (૩) શ્રી કશ્યપ આઇ. પરીખ અને (૪) શ્રી મનોજ એલ. મકવાણાને આ પેનલ પર નિયુક્તિ આપવામાં આવે છે."
    )
    sents = split_into_sentences(text)
    assert len(sents) == 1
    assert "રિધ્ધેશ આર. પાઠક" in sents[0] and "મનોજ એલ. મકવાણા" in sents[0]

    # Also verifies select_sentences never produces duplicate sentence indices when context neighbors are pulled
    items = [
        {"text": "TARIFF PLAN:", "chunk": 0, "rank": 0, "bonus": 0.0},
        {"text": "Monthly Rental per Connection Rs. 28.60", "chunk": 0, "rank": 0, "bonus": 0.0},
        {"text": "Pulse Rate 60 Second", "chunk": 0, "rank": 0, "bonus": 0.0},
    ]
    chosen = select_sentences(items, {"monthly", "rental", "pulse", "rate"}, budget=1000, chunk_cap=1000)
    assert len(chosen) == len(set(chosen))
    assert set(chosen) == {0, 1, 2}

    wrapped = (
        "૨. જે અન્વયે ગુજરાત રાજ્યમાં આંતરરાષ્ટ્રીય સરહદ ધરાવતા બનાસકાંઠા,પાટણ તથા\n"
        "કચ્છ જિલ્લામાં આવેલ આંતરરાષ્ટ્રીય સરહદ પરના ગામોમાં માળખાગત સુવિધાઓ પૂરી પાડવા."
    )
    fused = split_into_sentences(wrapped)
    assert len(fused) == 1
    assert "બનાસકાંઠા,પાટણ તથા કચ્છ" in fused[0]

    # Bare table Sr. No. '3' must stay on row 3 rather than fusing into Monthly Rental row 2
    tariff = "2 Monthly Rental per Connection\n` 28.60\n3\nPulse Rate in Seconds\n60 Second"
    tariff_sents = split_into_sentences(tariff)
    assert any("28.60" in s and "Pulse Rate" not in s and not s.endswith(" 3") for s in tariff_sents)
    assert any("Pulse Rate in Seconds 60 Second" in s for s in tariff_sents)


