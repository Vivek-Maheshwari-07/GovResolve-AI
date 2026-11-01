"""Question guards: legal-advice traps and too-vague questions, in English, Gujarati and Gujarati written in Latin letters."""
import pytest

pytest.importorskip("backend.rag.search_engine")
from backend.rag.search_engine import is_out_of_scope, is_too_vague  # noqa: E402


@pytest.mark.parametrize("q", [
    "Can I sue the department for wrongly denying my promotion and will I win?",
    "Should I go to court about my transfer order?",
    "What are my chances of winning if I file a case?",
    "Is it legal for the department to cancel my leave?",
    "મારું પ્રમોશન ખોટી રીતે અટકાવવામાં આવ્યું છે, શું મારે કોર્ટમાં કેસ કરવો જોઈએ?",
    "શું હું કેસ જીતી શકું?",
    "Mane promotion nathi malyu, shu hu court ma jaine kes jitish?",
    "hu kes karu to jitish?",
])
def test_legal_advice_and_outcome_predictions_are_out_of_scope(q):
    assert is_out_of_scope(q)


@pytest.mark.parametrize("q", [
    "What is the age limit for direct selection of a stenographer?",
    "Under which rule can a disciplinary case be started?",           # 'case' in a rules question
    "ખાતાકીય તપાસના કેસોમાં મિત્રમદદનીશની સેવા કેવી રીતે લેવી?",         # 'cases' in a procedure question
    "High Court matters: how are para wise remarks prepared?",
    "Kes na nikal mate shu karvu?",
    "Which court cases may be transferred to the Tribunal?",
])
def test_ordinary_questions_are_not_blocked_as_legal_advice(q):
    assert not is_out_of_scope(q)


@pytest.mark.parametrize("q", [
    "leave", "Tell me about the rules.", "What is the leave policy?", "give me details", "salary ni vaat karo",
    "નિયમો જણાવો", "રજા વિશે માહિતી આપો", "પગાર વિશે કહો", "GR", "Endorsement",
])
def test_questions_naming_only_a_broad_topic_are_too_vague(q):
    assert is_too_vague(q)


@pytest.mark.parametrize("q", [
    "LTC rules", "casual leave days", "Maternity leave", "GR 2021/130", "CCC exam", "How many days of earned leave?",
    "પ્રસૂતિ રજા", "સિનિયર ક્લાર્ક પરીક્ષા", "pension for freedom fighters", "rules for stenographer recruitment",
])
def test_short_but_specific_questions_are_not_vague(q):
    assert not is_too_vague(q)
