"""Cross-lingual retrieval: a Gujarati / Gujlish question is rendered in English (one short model call) for keyword search and sentence choice."""
import pytest

pytest.importorskip("backend.rag.search_engine")
import backend.rag.llm_gateway as gw  # noqa: E402
import backend.rag.search_engine as se  # noqa: E402
from backend.rag.search_engine import RAGPipeline  # noqa: E402

GU_Q = "ગુજરાતી સ્ટેનોગ્રાફર ગ્રેડ-૩ની જગ્યા માટે ઉંમરની મર્યાદા કેટલી છે?"
LATIN_Q = "Gujarati Stenographer Grade III ni direct selection mate age limit shu che?"
EN_Q = "What is the age limit for direct selection of a Gujarati Stenographer, Grade III?"
MIXED_GUJLISH_Q = "Leave par hoy tyare officer ane employee e phone ane email par available rehvanu padse?"
CCC_Q = "Which university was entrusted with conducting CCC and CCC+ examinations in place of the Technical Examination Board?"
INQUIRY_Q = "How does the government speed up disposal of departmental inquiry cases against officers?"
EN_TEXT = ("Notification General Administration Department of the State Secretariat Gandhinagar. "
           "Appointment to the post of Gujarati Stenographer, Grade III shall be made by direct selection. "
           "(a) not be less than twenty years and more than forty years of age and of good standing:")


@pytest.fixture
def model(monkeypatch):
    """Fake language model for the gateway: records calls, answers with `replies[0]`."""
    calls, state = [], {"reply": EN_Q, "provider": "local"}

    def fake(system, user, max_tokens=None, json_mode=True):
        calls.append((system, user, max_tokens))
        return state["reply"], state["provider"]

    monkeypatch.setattr(gw, "execute_llm_generation", fake)
    monkeypatch.setattr(gw, "_TRANSLATIONS", {})
    monkeypatch.setattr(gw, "_TRANSLATIONS_LOADED", True)
    monkeypatch.setattr(gw, "_TRANSLATIONS_GU", {})
    monkeypatch.setattr(se, "translate_to_english", gw.translate_to_english)   # undo the test default (no translation)
    return calls, state


def pipeline():
    class Index:
        def search(self, bundle, top_k=20, filters=None):
            return []
    return RAGPipeline(Index(), [])


@pytest.mark.parametrize("reply,expected", [
    ("What is the age limit?", "What is the age limit?"),
    ('"What is the age limit?"', "What is the age limit?"),
    ("Translation: What is the age limit?", "What is the age limit?"),
    ("English translation - What is the age limit?\nThis translates the question.", "What is the age limit?"),
    ("", None), ("   \n ", None), ("ઉંમરની મર્યાદા કેટલી છે?", None), ("ok", None),
])
def test_the_models_reply_is_cleaned_to_one_english_sentence_or_rejected(reply, expected):
    assert gw._clean_translation(reply) == expected


def test_one_short_call_per_new_question_then_it_is_remembered(model):
    calls, _ = model
    assert gw.translate_to_english(GU_Q) == EN_Q and gw.translate_to_english(GU_Q) == EN_Q
    assert len(calls) == 1 and calls[0][1] == GU_Q and calls[0][2] == 80         # short reply cap
    assert "translate" in calls[0][0].lower() and "Gujarat Government Resolutions" in calls[0][0]


def test_nothing_is_remembered_or_returned_when_no_model_answers(model):
    calls, state = model
    state["provider"] = "fallback"
    assert gw.translate_to_english(GU_Q) is None
    state["provider"] = "local"
    assert gw.translate_to_english(GU_Q) == EN_Q and len(calls) == 2           # the failure was not cached


def test_english_questions_need_no_english_translation(model):
    """An English question is never translated to English; it only gets one (cached) Gujarati rendering for Gujarati GRs."""
    calls, _ = model
    bundle = pipeline().prepare(EN_Q)
    assert bundle.detected_lang == "en"
    assert not [c for c in calls if "into English" in c[0]]
    assert len(calls) <= 1


def test_mixed_english_and_gujlish_is_translated_for_search(model):
    calls, _ = model
    bundle = pipeline().prepare(MIXED_GUJLISH_Q)

    assert bundle.detected_lang == "gujlish"
    assert EN_Q in bundle.query_en
    assert {"leave", "officer", "employee", "phone", "email", "available"} <= set(bundle.query_en.lower().split())
    assert len([c for c in calls if "into English" in c[0]]) == 1


def test_fast_gujlish_adds_known_gujarati_terms_for_evidence_selection(model, monkeypatch):
    calls, state = model
    state["reply"] = "Are officers and employees required to be available on phone and email?"
    monkeypatch.setenv("LOCAL_FAST_MODE", "1")
    pipe = pipeline()
    bundle = pipe.prepare(MIXED_GUJLISH_Q)
    passage = {
        "chunk_id": "GR-1:1",
        "text": "તેમજ રજાઓ દરમિયાન કર્મચારી/અધિકારીએ ફોન/ઈ.મેઈલ પર સતત ઉપલબ્ધ રહેવાનું રહેશે.",
        "rrf_score": 1.0,
        "metadata": {"gr_id": "GR-1", "gr_number": "X/1", "issue_date": "2025-05-13", "pages": "[1]"},
    }

    evidence, _, _ = pipe.build_evidence(MIXED_GUJLISH_Q, [passage], bundle)

    assert all(term in bundle.query_gu for term in ("ફોન", "ઈ.મેઈલ", "કર્મચારી", "અધિકારી", "ઉપલબ્ધ"))
    assert passage["text"] in evidence
    assert not [call for call in calls if "into Gujarati" in call[0]]


def test_fast_english_queries_get_specific_gujarati_search_terms(monkeypatch):
    monkeypatch.setenv("LOCAL_FAST_MODE", "1")

    bundle = pipeline().prepare(CCC_Q)

    assert bundle.detected_lang == "en"
    assert "ટેકનિકલ પરીક્ષા બોર્ડ" in bundle.query_gu


def test_generic_disposal_does_not_expand_to_dead_stock_terms(monkeypatch):
    monkeypatch.setenv("LOCAL_FAST_MODE", "1")

    bundle = pipeline().prepare(INQUIRY_Q)

    assert "dead stock" not in bundle.query_en
    assert "ડેડસ્ટોક" not in bundle.query_gu
    assert "લોક અદાલત" in bundle.query_gu


def test_script_mismatch_does_not_outrank_a_lower_ranked_matching_sentence():
    from backend.rag.search_engine import select_sentences

    items = [
        {"text": "Government policy details are listed here.", "chunk": 0, "rank": 0},
        {"text": "ખાતાકીય તપાસના કેસોનો ઝડપી નિકાલ થાય છે.", "chunk": 1, "rank": 1},
    ]

    selected = select_sentences(items, {"ખાતાકીય", "તપાસ"}, budget=300, chunk_cap=300)

    assert selected[0] == 1


def test_evidence_searches_all_retrieved_documents_for_answer_chunks(monkeypatch):
    monkeypatch.setenv("LOCAL_FAST_MODE", "1")

    class Index:
        bm25_docs = [{
            "chunk_id": "target:answer",
            "gr_id": "target",
            "text": "ખાતાકીય તપાસના કેસોનો ઝડપી નિકાલ કરવા લોક અદાલત જેવું તંત્ર ઊભું કરવામાં આવે છે.",
            "gr_number": "X/target",
            "issue_date": "2019-09-24",
            "pages": [1],
            "clause_status": "Unknown",
        }]
        bm25 = object()

        def _bm25_scores(self, query):
            return [5.0]

    passages = [{
        "chunk_id": f"other-{i}:1",
        "text": "Government officers may face disciplinary proceedings while an inquiry is pending.",
        "rrf_score": 1.0 / (i + 1),
        "metadata": {"gr_id": f"other-{i}", "gr_number": f"X/{i}", "issue_date": "", "pages": "[1]"},
    } for i in range(5)]
    passages.append({
        "chunk_id": "target:retrieved",
        "text": "ખાતાકીય તપાસ અંગેની નોંધ.",
        "rrf_score": 0.01,
        "metadata": {"gr_id": "target", "gr_number": "X/target", "issue_date": "2019-09-24", "pages": "[1]"},
    })

    evidence, registry, _ = RAGPipeline(Index(), []).build_evidence(
        INQUIRY_Q, passages, se.normalizer.normalize(INQUIRY_Q)
    )

    assert "લોક અદાલત જેવું તંત્ર" in evidence
    assert any(item["gr_id"] == "target" for item in registry.values())


@pytest.mark.parametrize("question", [EN_Q, LATIN_Q])
def test_fast_local_mode_skips_the_extra_gujarati_translation(model, monkeypatch, question):
    calls, state = model
    state["reply"] = EN_Q
    gujarati_calls = []
    monkeypatch.setenv("LOCAL_FAST_MODE", "1")
    monkeypatch.setattr(se, "translate_to_gujarati", lambda q: gujarati_calls.append(q))

    bundle = pipeline().prepare(question)

    assert bundle.original_query == question
    assert gujarati_calls == []
    if question == LATIN_Q:
        assert bundle.query_en == EN_Q
        assert len([c for c in calls if "into English" in c[0]]) == 1


@pytest.mark.parametrize("question", [GU_Q, LATIN_Q])
def test_non_english_questions_get_an_english_rendering_in_the_search_bundle(model, question):
    calls, state = model
    state["reply"] = "What is the age limit for direct selection of a Gujarati Stenographer, Grade III?"
    original = se.normalizer.normalize(question)
    bundle = pipeline().prepare(question)
    assert len([c for c in calls if "into English" in c[0]]) == 1 and bundle.query_en == state["reply"]
    assert bundle.original_query == question and bundle.query_gu == original.query_gu          # the original channels stay
    assert {"stenographer", "selection", "age", "limit"} <= set(bundle.keywords)             # English words reach the keyword search
    assert set(original.keywords) <= set(bundle.keywords)


def test_without_a_model_the_bundle_is_the_one_we_had_before(model):
    _, state = model
    state["provider"] = "fallback"
    assert pipeline().prepare(GU_Q) == se.normalizer.normalize(GU_Q)


def test_the_english_rendering_lets_a_gujarati_question_choose_the_english_sentence(model, monkeypatch):
    _, state = model
    state["reply"] = EN_Q
    monkeypatch.setattr(se, "EVIDENCE_MAX_CHARS", 190)          # room for two of the three sentences
    pipe = pipeline()
    passages = [{"chunk_id": "c1", "text": EN_TEXT, "rrf_score": 1.0,
                 "metadata": {"gr_id": "GR-1", "gr_number": "X/1", "issue_date": "2019-11-08", "pages": "[1]"}}]
    with_english, _, _ = pipe.build_evidence(GU_Q, passages, pipe.prepare(GU_Q))
    assert "forty years of age" in with_english and "Notification General Administration" not in with_english
    # Gujarati words alone share nothing with the English text, so the chunk is just read from the top (letterhead first)
    without, _, _ = pipe.build_evidence(GU_Q, passages)
    assert "Notification General Administration" in without and "forty years of age" not in without
