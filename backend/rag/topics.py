"""What the collection covers, and example questions that are known to work.

Used for two things, with no model call:
  * `GET /coverage`: the "what can I ask?" panel on the landing page (topics with how many resolutions mention them).
  * clickable suggestions when a question is too broad ("leave", "પગાર"): instead of a dead end the user gets a few concrete
    questions to click.

Every example below is a verified question from `data/eval/gold_questions.json` (its key points occur on the cited page), or a
sample used in the demo, so a click always leads to a real, cited answer. A topic only shows when at least one resolution in the
loaded collection matches it, so the panel never promises something the collection does not hold.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

# group: which broad words lead to this topic when a question is too vague ("leave", "salary", "pension", anything else -> "rules")
TOPICS: list[dict[str, Any]] = [
    {"id": "recruitment", "group": "rules", "en": "Recruitment and age limits", "gu": "ભરતી અને ઉંમર મર્યાદા",
     "pattern": r"recruitment|direct selection|age limit|age relax|ભરતી|સીધી પસંદગી|ઉંમર|વયમર્યાદા",
     "examples": [("en", "What is the age range for direct selection to the post of Gujarati Stenographer, Grade III?"),
                  ("gu", "ગુજરાતી સ્ટેનોગ્રાફર, ગ્રેડ-૩ની જગ્યા માટે સીધી પસંદગીમાં ઉંમરની મર્યાદા કેટલી છે?")]},
    {"id": "panchayat", "group": "rules", "en": "Panchayat and rural development", "gu": "પંચાયત અને ગ્રામ વિકાસ",
     "pattern": r"panchayat|rural|પંચાયત|ગ્રામ",
     "examples": [("en", "What is the upper age limit for direct selection of a Multi Purpose Health Worker (Male), and was it changed by any amendment?")]},
    {"id": "computer", "group": "rules", "en": "Computer competency rules", "gu": "કમ્પ્યુટર કૌશલ્ય નિયમો",
     "pattern": r"computer|કમ્પ્યુટર|કોમ્પ્યુટર",
     "examples": [("en", "From which date do the Gujarat Civil Services Computer Competency Training and Examination Rules, 2006 come into force?"),
                  ("gu", "ગુજરાત સિવિલ સર્વિસીસ કમ્પ્યુટર કોમ્પિટન્સી ટ્રેઇનિંગ એન્ડ એક્ઝામિનેશન નિયમો, ૨૦૦૬ કઈ તારીખથી અમલમાં આવ્યા?")]},
    {"id": "training", "group": "rules", "en": "Training and departmental exams", "gu": "તાલીમ અને ખાતાકીય પરીક્ષા",
     "pattern": r"pre-service training|post-training|departmental exam|training and examination|તાલીમ",
     "examples": [("en", "How many days of pre-service training did the October 2025 amendment set in rule 6 of the Gazetted Officers' (Pre-service Training) rules?")]},
    {"id": "ltc", "group": "leave", "en": "Leave Travel Concession (LTC)", "gu": "લીવ ટ્રાવેલ કન્સેશન (એલ.ટી.સી.)",
     "pattern": r"\bLTC\b|leave travel|લીવ ટ્રાવેલ",
     "examples": [("en", "For how long did the Central Government suspend Home Town LTC and All India LTC in 2001?"),
                  ("mixed", "Central government e Home Town LTC ane All India LTC ketla time mate suspend kari hati?")]},
    {"id": "leave", "group": "leave", "en": "Leave and availability of officers", "gu": "રજા અને અધિકારીઓની ઉપલબ્ધતા",
     "pattern": r"\bleave\b|headquarter|રજા|મુખ્યમથક",
     "examples": [("gu", "શું સરકારી અધિકારી/કર્મચારીઓની તમામ રજાઓ હાલમાં રદ છે?"),
                  ("mixed", "Leave par hoy tyare officer ane employee e phone ane email par available rehvanu padse?")]},
    {"id": "allowances", "group": "pay", "en": "Travelling and other allowances", "gu": "પ્રવાસ અને અન્ય ભથ્થાં",
     "pattern": r"allowance|ભથ્થ",
     "examples": [("en", "From which date were the 2022 amendments to the Gujarat Minister's Travelling Allowances Rules deemed to be in force?"),
                  ("mixed", "Gujarat Minister's Travelling Allowances (Amendment) Rules 2022 kya divas thi amal ma gana jashe?")]},
    {"id": "facilities", "group": "rules", "en": "Mobile phones and office facilities", "gu": "મોબાઇલ ફોન અને કચેરી સુવિધાઓ",
     "pattern": r"mobile|guest house|ગેસ્ટ હાઉસ|મોબાઇલ",
     "examples": [("en", "From which date did the new mobile phone tariff for government use apply, and whose offer was accepted?")]},
]

_LANG_PREF = {"gu": ("gu", "mixed", "en"), "gujlish": ("mixed", "en", "gu"), "mixed": ("mixed", "en", "gu"), "en": ("en", "mixed", "gu")}

_LEAVE = {"leave", "leaves", "raja", "rajao", "chhutti", "chutti", "રજા", "રજાઓ", "છુટ્ટી"}
_PAY = {"salary", "salaries", "pay", "allowance", "allowances", "pagar", "bhatthu", "bhattha", "પગાર", "ભથ્થું", "ભથ્થા"}
_PENSION = {"pension", "pensions", "પેન્શન"}


def _text_of(record: Any, chunks: int = 3) -> str:
    parts = [str(getattr(record, "subject", "") or "")]
    for ch in list(getattr(record, "chunks", []) or [])[:chunks]:
        parts.append(str(getattr(ch, "text", "") or ""))
    return " ".join(parts)


def compute_coverage(records: Iterable[Any]) -> dict[str, Any]:
    """Counts for the landing page. `records` are GR records (either model: they only need `gr_id`, `subject`, `issue_date`,
    `language`, `department` and `chunks[].text`). Topics with no matching resolution are left out."""
    recs = list(records)
    texts = [_text_of(r) for r in recs]
    topics = []
    for t in TOPICS:
        rx = re.compile(t["pattern"], re.I)
        n = sum(1 for tx in texts if rx.search(tx))
        if n:
            topics.append({"id": t["id"], "group": t["group"], "label_en": t["en"], "label_gu": t["gu"], "count": n,
                           "examples": [{"language": lang, "text": q} for lang, q in t["examples"]]})
    topics.sort(key=lambda x: -x["count"])
    dates = sorted(str(r.issue_date) for r in recs if getattr(r, "issue_date", None))
    langs: dict[str, int] = {}
    for r in recs:
        lg = str(getattr(getattr(r, "language", ""), "value", getattr(r, "language", "")) or "")
        langs[lg] = langs.get(lg, 0) + 1
    return {"total_grs": len(recs), "first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None,
            "languages": langs, "topics": topics}


def _ordered_examples(topic: dict[str, Any], pref: tuple[str, ...]) -> list[str]:
    """A topic's example questions in the user's language first; other languages only if it has none in the first two."""
    same = [e for e in topic["examples"] if e["language"] in pref[:2]]
    chosen = same or topic["examples"]
    return [e["text"] for e in sorted(chosen, key=lambda e: pref.index(e["language"]) if e["language"] in pref else 9)]


def vague_options(query: str, topics: list[dict[str, Any]], language: str = "en", limit: int = 4) -> list[str]:
    """Concrete questions to offer when `query` names only a broad topic. Leave words lead to the leave topics, pay words to the
    allowance topic, anything else to the biggest topics. Examples come in the user's language. Empty if no topic is loaded."""
    words = set(re.findall(r"[\w઀-૿]+", (query or "").lower()))
    group = "leave" if words & _LEAVE else "pay" if words & _PAY else "pension" if words & _PENSION else "rules"
    pref = _LANG_PREF.get(language, _LANG_PREF["en"])
    pool = [t for t in topics if t["group"] == group]
    others = [t for t in topics if t["group"] != group]
    out: list[str] = []
    for tier in (pool, others):  # the matching topics first (round-robin, so each gets a turn), then the biggest others
        lists = [_ordered_examples(t, pref) for t in tier]
        for rank in range(3):
            for lst in lists:
                if rank < len(lst) and lst[rank] not in out:
                    out.append(lst[rank])
        if len(out) >= limit:
            break
    return out[:limit]
