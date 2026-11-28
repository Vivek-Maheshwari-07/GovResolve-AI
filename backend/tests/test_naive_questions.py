"""Everyday questions: the formal-words rewrite, suggestions on a refusal, click-through options on a too-broad question, coverage."""
from types import SimpleNamespace as NS

import pytest

from app.squad2_bridge import to_engine_result
from backend.rag import llm_gateway
from backend.rag.topics import TOPICS, compute_coverage, vague_options

se = pytest.importorskip("backend.rag.search_engine")


def rec(gr_id, subject, text="", date="2020-01-01", lang="en"):
    return NS(gr_id=gr_id, gr_number=gr_id.upper(), subject=subject, issue_date=date, language=lang, chunks=[NS(text=text)])


RECS = [rec("a", "Leave Travel Concession rules", "LTC is suspended"), rec("b", "Allowances", "travelling allowance for ministers"),
        rec("c", "Recruitment rules", "direct selection, age limit 40 years", date="2019-05-01"),
        rec("d", "Computer competency", "computer examination")]


# ---- rewrite -------------------------------------------------------------------------------------------------------------------
def test_clean_rewrite_keeps_english_terms_and_drops_labels():
    assert llm_gateway._clean_rewrite("Terms: family pension, death-cum-retirement gratuity, compassionate appointment") == \
        "family pension, death-cum-retirement gratuity, compassionate appointment"


@pytest.mark.parametrize("reply", ["", "ok", "સરકારી કર્મચારી પેન્શન ગ્રેચ્યુઇટી", "x" * 500])
def test_clean_rewrite_rejects_unusable_replies(reply):
    assert llm_gateway._clean_rewrite(reply) is None


def test_rewrite_is_called_once_per_question_and_remembered(monkeypatch):
    calls = []
    monkeypatch.setattr(llm_gateway, "execute_llm_generation", lambda *a, **k: (calls.append(a) or "family pension, gratuity, death benefit", "groq"))
    monkeypatch.setattr(llm_gateway, "_translation_cache_path", lambda: None)
    llm_gateway._REWRITES.clear()
    assert llm_gateway.rewrite_for_search("my father died in service") == "family pension, gratuity, death benefit"
    assert llm_gateway.rewrite_for_search("my father died in service") == "family pension, gratuity, death benefit"
    assert len(calls) == 1


def test_a_failed_model_call_is_not_remembered(monkeypatch):
    monkeypatch.setattr(llm_gateway, "execute_llm_generation", lambda *a, **k: ("", "fallback"))
    monkeypatch.setattr(llm_gateway, "_translation_cache_path", lambda: None)
    llm_gateway._REWRITES.clear()
    assert llm_gateway.rewrite_for_search("anything") is None
    assert "anything" not in llm_gateway._REWRITES


def test_rewrite_is_off_unless_asked_for(monkeypatch):
    monkeypatch.delenv("QUERY_REWRITE", raising=False)
    monkeypatch.setattr(se, "primary_provider_name", lambda: "groq")
    assert se.rewrite_enabled() is False


def test_rewrite_mode_switch(monkeypatch):
    monkeypatch.setenv("QUERY_REWRITE", "on")
    assert se.rewrite_enabled() is True
    monkeypatch.setenv("QUERY_REWRITE", "off")
    assert se.rewrite_enabled() is False
    monkeypatch.setenv("QUERY_REWRITE", "auto")
    monkeypatch.setattr(se, "primary_provider_name", lambda: "ollama")   # slow local model: off
    assert se.rewrite_enabled() is False
    monkeypatch.setattr(se, "primary_provider_name", lambda: "groq")
    assert se.rewrite_enabled() is True


# ---- coverage and click-through options ----------------------------------------------------------------------------------------
def test_coverage_counts_only_topics_the_collection_holds():
    cov = compute_coverage(RECS)
    ids = {t["id"] for t in cov["topics"]}
    assert {"ltc", "allowances", "recruitment", "computer"} <= ids
    assert "panchayat" not in ids                       # no record mentions it: never promised
    assert cov["total_grs"] == 4 and cov["first_date"] == "2019-05-01" and cov["last_date"] == "2020-01-01"
    assert all(t["count"] > 0 and t["examples"] for t in cov["topics"])


def test_every_topic_example_is_a_nonempty_question_in_a_known_language():
    for t in TOPICS:
        assert t["examples"], t["id"]
        for lang, q in t["examples"]:
            assert lang in ("en", "gu", "mixed") and q.strip().endswith("?")


def test_vague_leave_offers_leave_questions_first_in_the_users_language():
    topics = compute_coverage(RECS)["topics"]
    opts = vague_options("leave", topics, "en", limit=2)
    assert len(opts) == 2 and any("LTC" in o for o in opts)
    gu = vague_options("રજા", topics, "gu", limit=3)
    assert gu and all(isinstance(o, str) for o in gu)


def test_vague_options_are_empty_when_nothing_is_loaded():
    assert vague_options("leave", [], "en") == []


# ---- nearest documents ---------------------------------------------------------------------------------------------------------
def passage(gid, text, page=2):
    return {"chunk_id": f"{gid}:1", "text": text, "metadata": {"gr_id": gid, "gr_number": gid.upper(), "issue_date": "2020-01-01", "pages": f"[{page}]"}}


def test_nearest_documents_share_a_word_with_the_question_and_are_distinct():
    recs = {"a": rec("a", "Leave Travel Concession"), "b": rec("b", "Allowances")}
    ps = [passage("a", "LTC for home town is suspended", 3), passage("a", "more LTC text"), passage("b", "travelling allowance rates")]
    got = se.nearest_documents(ps, "when is the LTC restored", recs)
    assert [d.gr_id for d in got] == ["a"] and got[0].page == 3 and got[0].subject == "Leave Travel Concession"


def test_common_words_and_a_two_word_minimum_keep_weak_matches_out():
    recs = {"a": rec("a", "Allowances for government employees")}
    ps = [passage("a", "government employees loan advance rules")]
    # one shared word ("loan") is not enough when two are required; generic words do not count at all
    assert se.nearest_documents(ps, "bike loan for government employees", recs, min_overlap=2, common=frozenset({"government", "employees"})) == []
    assert len(se.nearest_documents(ps, "loan advance rules", recs, min_overlap=2, common=frozenset({"government", "employees"}))) == 1


def test_an_unrelated_question_gets_no_suggestions():
    recs = {"a": rec("a", "Leave Travel Concession")}
    assert se.nearest_documents([passage("a", "LTC for home town")], "bike loan", recs) == []
    assert se.nearest_documents([passage("a", "x")], "tell me about", recs) == []   # only filler words


# ---- the contract: new fields are optional and pass through --------------------------------------------------------------------
def test_bridge_carries_suggestions_and_options_on_a_refusal():
    r = NS(answer_status=NS(value="Insufficient Evidence"), summary="", insufficient_reason=NS(value="NO_DOCUMENT"), citations=[],
           follow_up_question=None, suggested_documents=[NS(gr_id="a", gr_number="A/1", subject="S", issue_date="2020-01-01", page=2)],
           follow_up_options=["Which leave?"])
    out = to_engine_result(r)
    assert out.suggestions == [{"doc_id": "a", "gr_number": "A/1", "subject": "S", "issue_date": "2020-01-01", "page": 2}]
    assert out.follow_up_options == ["Which leave?"]


def test_bridge_still_works_when_the_pipeline_has_no_new_fields():
    r = NS(answer_status=NS(value="Insufficient Evidence"), summary="", insufficient_reason=NS(value="NO_DOCUMENT"), citations=[], follow_up_question=None)
    out = to_engine_result(r)
    assert out.suggestions == [] and out.follow_up_options == []


def test_coverage_endpoint(client):
    body = client.get("/coverage").json()
    assert body["total_grs"] >= 1 and isinstance(body["topics"], list)
