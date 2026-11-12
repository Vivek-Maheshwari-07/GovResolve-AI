"""Cross-lingual retrieval: a Gujarati / Gujlish question is rendered in English (one short model call) for keyword search and sentence choice."""
import pytest

pytest.importorskip("backend.rag.search_engine")
import backend.rag.llm_gateway as gw  # noqa: E402
import backend.rag.search_engine as se  # noqa: E402
from backend.rag.search_engine import RAGPipeline  # noqa: E402

GU_Q = "ગુજરાતી સ્ટેનોગ્રાફર ગ્રેડ-૩ની જગ્યા માટે ઉંમરની મર્યાદા કેટલી છે?"
LATIN_Q = "Gujarati Stenographer Grade III ni direct selection mate age limit shu che?"
EN_Q = "What is the age limit for direct selection of a Gujarati Stenographer, Grade III?"
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
