"""Build eval/gold_questions.json from the question definitions below and check every answerable one against the corpus text.

Usage (from backend/):
    python -m scripts.make_gold_questions --corpus D:/test/corpus_v2 [--out ../eval/gold_questions.json]

A question is only written if each of its key points occurs (after normalising digits, case and punctuation) on the cited page(s),
so a gold answer can never rest on a fact that is not in the document. Questions were drafted by Claude from the extracted text of
the documents; they are NOT officer-validated (`validated_by` says so). Document ids are short prefixes such as `1_3989`.

Fields: category simple | amended | superseded | unanswerable | vague; expected_verdict answered | insufficient_evidence;
expected_reason_code (refusals); gold_docs [{doc_id, page}] (any one counts for retrieval); key_points (string, or list of
alternatives); expected_status_any (lineage statuses, at least one cited document must show one).
"""
import argparse
import json
import sys
from pathlib import Path

from scripts.scorecard import ROOT, norm

BY = "drafted by Claude from the document text; not officer-validated"


def A(qid, lang, cat, q, docs, points, note, status=None):
    """An answerable question. docs = [(short doc id, page), ...]."""
    d = {"question_id": qid, "question": q, "language": lang, "category": cat, "expected_verdict": "answered",
         "expected_reason_code": None, "gold_docs": [{"doc_id": k, "page": p} for k, p in docs], "key_points": points,
         "evidence_note": note, "validated_by": BY}
    if status:
        d["expected_status_any"] = status
    return d


def R(qid, lang, cat, q, code, note):
    """A question the system must refuse (cat unanswerable or vague)."""
    return {"question_id": qid, "question": q, "language": lang, "category": cat, "expected_verdict": "insufficient_evidence",
            "expected_reason_code": code, "gold_docs": [], "key_points": [], "evidence_note": note, "validated_by": BY}


QUESTIONS = [
    # ── simple: one document, one fact ──
    A("Q-001", "en", "simple", "What is the age range for direct selection to the post of Gujarati Stenographer, Grade III?",
      [("1_3989", 1)], ["20 years", "40 years"], "Rules 2019: 'not be less than 20 years and more than 40 years of age'"),
    A("Q-002", "gu", "simple", "ગુજરાતી સ્ટેનોગ્રાફર, ગ્રેડ-૩ની જગ્યા માટે સીધી પસંદગીમાં ઉંમરની મર્યાદા કેટલી છે?",
      [("1_3989", 1)], ["20", "40"], "same page as Q-001 (Gujarati question about an English document)"),
    A("Q-003", "en", "simple", "For how long did the Central Government suspend Home Town LTC and All India LTC in 2001?",
      [("1_728", 1)], ["two years"], "GR 10 May 2001: suspended 'for a period of two years'"),
    A("Q-004", "mixed", "simple", "Central government e Home Town LTC ane All India LTC ketla time mate suspend kari hati?",
      [("1_728", 1)], [["two years", "2 years", "બે વર્ષ", "બે વરસ"]], "same page as Q-003"),
    A("Q-005", "en", "simple", "Which bank holiday did Gujarat cancel in 2013 because of the half yearly closing of accounts?",
      [("1_551", 1)], ["30th September, 2013"], "Notification 22 Feb 2013 cancels Monday 30 September 2013"),
    A("Q-006", "mixed", "simple", "Banks ni 30 September 2013 ni half yearly closing ni holiday shu cancel thai?",
      [("1_551", 1)], [["30th September", "30 September", "30 સપ્ટેમ્બર"]], "same page as Q-005"),
    A("Q-007", "en", "simple", "How many suites and rooms does the Garvi Gujarat guest house in New Delhi have?",
      [("1_2023", 1)], ["78"], "GR 7 Sep 2019: 'The total number of suites/rooms ... is 78'"),
    A("Q-008", "gu", "simple", "નવી દિલ્હીના ગરવી ગુજરાત ગેસ્ટ હાઉસમાં કુલ કેટલા સ્યુટ અને રૂમ છે?",
      [("1_2023", 1)], ["78"], "same page as Q-007"),
    A("Q-009", "en", "simple", "From which date did the new mobile phone tariff for government use apply, and whose offer was accepted?",
      [("1_1687", 1)], ["1st October, 2015", "Vodafone"], "Resolution 15 Oct 2015: Vodafone West Limited; tariff from 1 October 2015"),
    A("Q-010", "mixed", "simple", "Government na mobile phone mate navo tariff kya divas thi lagu thayo ane kai company ni offer swikari?",
      [("1_1687", 1)], [["1st October, 2015", "1 October 2015", "1 ઓક્ટોબર"], ["Vodafone", "વોડાફોન"]], "same page as Q-009"),
    A("Q-011", "en", "simple", "Who was appointed Chief Electoral Officer for Gujarat in May 2021?",
      [("1_2245", 1)], ["Anupam Anand"], "Notification 3 May 2021"),
    A("Q-012", "gu", "simple", "મે ૨૦૨૧માં ગુજરાતના મુખ્ય ચૂંટણી અધિકારી તરીકે કોની નિમણૂક થઈ?",
      [("1_2245", 1)], [["Anupam Anand", "અનુપમ આનંદ"]], "same page as Q-011"),
    A("Q-013", "en", "simple", "From which date were the 2022 amendments to the Gujarat Minister's Travelling Allowances Rules deemed to be in force?",
      [("1_3954", 1)], ["22nd March, 2022"], "Amendment Rules 2022: 'deemed to have come into force on 22nd March, 2022'"),
    A("Q-014", "mixed", "simple", "Gujarat Minister's Travelling Allowances (Amendment) Rules 2022 kya divas thi amal ma gana jashe?",
      [("1_3954", 1)], [["22nd March, 2022", "22 March 2022", "22 માર્ચ"]], "same page as Q-013"),
    A("Q-015", "en", "simple", "What are the marks and duration of Paper V (Administrative Matters) in the Senior Clerk Class III post-training examination after the 2020 amendment?",
      [("1_2195", 1)], ["100", "2 Hours"], "Amendment Rules 2020: 'Paper V : Administrative Matters, Marks : 100, Duration: 2 Hours'"),
    A("Q-016", "gu", "simple", "૨૦૨૦ના સુધારા પછી સિનિયર ક્લાર્ક વર્ગ-૩ની પરીક્ષામાં પેપર-૫ (વહીવટી બાબતો)ના ગુણ અને સમય કેટલા છે?",
      [("1_2195", 1)], ["100", ["2 hours", "2 કલાક", "બે કલાક"]], "same page as Q-015"),
    A("Q-017", "en", "simple", "How much administrative experience must half of the members of the Gujarat Subordinate Service Selection Board have?",
      [("1_2375", 1)], ["ten years"], "GR 5 Oct 2021: 'at least ten years' administrative experience'"),
    A("Q-018", "mixed", "simple", "Gujarat Subordinate Service Selection Board na aadha members ne ketla varsh no administrative anubhav hovo joie?",
      [("1_2375", 1)], [["ten years", "10 years", "10 વર્ષ", "દસ વર્ષ"]], "same page as Q-017"),

    # ── amended: the answer is what an amendment changed ──
    A("Q-019", "en", "amended", "By how much was the upper age limit relaxed for direct selection under the Gujarat Civil Services Classification and Recruitment (General) Rules, 1967, in 2022?",
      [("1_3218", 1)], [["one year", "1 year"]], "Notification 29 Sep 2022, new rule 16H: relaxed by one year for advertisements 18 Sep 2022 - 31 Aug 2023"),
    A("Q-020", "en", "amended", "From which date do the Gujarat Civil Services Computer Competency Training and Examination Rules, 2006 come into force?",
      [("1_2209", 1)], ["October, 2006"], "Rules 2006, rule 1(2): in force from 1 October 2006; the rules were amended 24 times",
      status=["amended"]),
    A("Q-021", "gu", "amended", "ગુજરાત સિવિલ સર્વિસીસ કમ્પ્યુટર કોમ્પિટન્સી ટ્રેઇનિંગ એન્ડ એક્ઝામિનેશન નિયમો, ૨૦૦૬ કઈ તારીખથી અમલમાં આવ્યા?",
      [("1_2209", 1)], [["1 October 2006", "1 ઓક્ટોબર", "October, 2006", "ઓક્ટોબર ૨૦૦૬", "ઓક્ટોબર, ૨૦૦૬"]], "same page as Q-020",
      status=["amended"]),
    A("Q-022", "en", "amended", "In the September 2007 amendment of the Computer Competency rules, which date replaced 31st December 2007?",
      [("1_3472", 1)], ["30th June, 2008"], "Amendment 20 Sep 2007, rule 9(2) proviso"),
    A("Q-023", "gu", "amended", "સપ્ટેમ્બર ૨૦૦૭ના સુધારામાં કમ્પ્યુટર કૌશલ્ય પરીક્ષા માટે ૩૧ ડિસેમ્બર ૨૦૦૭ને બદલે કઈ તારીખ રાખવામાં આવી?",
      [("1_3472", 1)], [["30th June, 2008", "30 જૂન, 2008", "30 June 2008", "30 જૂન 2008"]], "same page as Q-022"),
    A("Q-024", "mixed", "amended", "Computer Competency rules ma May 2015 na amendment ma 55 years ni jagyae ketla years karya?",
      [("1_3499", 1)], [["50 years", "50 વર્ષ", "50 varsh", "50"]], "Amendment 22 May 2015: '55 years' replaced by '50 years' in rule 9(2)"),
    A("Q-025", "en", "amended", "By the January 2013 amendment, which date replaced 31st December 2012 in the provisos of rule 9(1) of the Computer Competency rules?",
      [("1_3314", 1), ("1_519", 1)], ["March, 2013"], "Amendment 31 Jan 2013"),
    A("Q-026", "en", "amended", "How many days of pre-service training did the October 2025 amendment set in rule 6 of the Gazetted Officers' (Pre-service Training and Examination) Rules?",
      [("1_3906", 1)], [["sixty three", "sixty-three", "63"]], "Gazette 4 Oct 2025: 'forty five days' replaced by 'sixty three days'"),
    A("Q-027", "mixed", "amended", "Gazetted Officers pre-service training rules ma January 2023 na notification e 60 percent ni jagyae ketla percent karya?",
      [("1_3252", 1)], [["50 percent", "50 ટકા", "50%", "50"]], "Notification 20 Jan 2023: '60 percent' replaced by '50 percent'"),
    A("Q-028", "gu", "amended", "૨૦૨૪ના સુધારા દ્વારા કમ્પ્યુટર કૌશલ્ય તાલીમના ૪૫ કલાકની જગ્યાએ કેટલા કલાક કરવામાં આવ્યા?",
      [("1_3807", 1), ("1_3828", 1)], [["60 hours", "60 કલાક", "60"]], "Notification 24 Jul 2024: '45 hours' replaced by '60 hours'"),

    # ── unanswerable: nothing in the corpus answers them ──
    R("Q-029", "en", "unanswerable", "How many days of maternity leave are allowed to women government employees?", "NO_DOCUMENT",
      "text search: 0 of 366 documents mention maternity / પ્રસૂતિ"),
    R("Q-030", "gu", "unanswerable", "સરકારી મહિલા કર્મચારીઓને પ્રસૂતિ રજા કેટલા દિવસની મળે છે?", "NO_DOCUMENT", "same as Q-029"),
    R("Q-031", "mixed", "unanswerable", "Dearness allowance no current rate ketla percent che?", "NO_DOCUMENT",
      "text search: one passing mention of dearness (a retired-officer pay clause), no allowance rate"),
    R("Q-032", "en", "unanswerable", "What is the monthly salary of the Chief Minister of Gujarat?", "NO_DOCUMENT", "text search: 0 documents give a Chief Minister salary"),
    R("Q-033", "gu", "unanswerable", "ગુજરાતમાં નવા વાહનની નોંધણી ફી કેટલી છે?", "NO_DOCUMENT", "outside the General Administration Department"),
    R("Q-034", "en", "unanswerable", "What is the penalty for filing income tax returns late?", "NO_DOCUMENT", "text search: 0 documents mention income tax"),
    R("Q-035", "en", "unanswerable", "Can I sue the department for wrongly denying my promotion and will I win?", "OUT_OF_SCOPE",
      "asks for legal advice and a prediction"),
    R("Q-036", "gu", "unanswerable", "મારું પ્રમોશન ખોટી રીતે અટકાવવામાં આવ્યું છે, શું મારે કોર્ટમાં કેસ કરવો જોઈએ?", "OUT_OF_SCOPE",
      "asks for legal advice"),
    R("Q-037", "mixed", "unanswerable", "Mane promotion nathi malyu, shu hu court ma jaine kes jitish?", "OUT_OF_SCOPE",
      "asks for legal advice and a prediction"),
    R("Q-038", "en", "unanswerable", "Who will be the next Chief Secretary of Gujarat?", "NO_DOCUMENT", "future event; the Chief Secretary appears only in distribution lists"),

    # ── vague: too little to search on ──
    R("Q-039", "en", "vague", "leave", "TOO_VAGUE", "one word"),
    R("Q-040", "en", "vague", "Tell me about the rules.", "TOO_VAGUE", "no subject"),
    R("Q-041", "gu", "vague", "નિયમો જણાવો", "TOO_VAGUE", "no subject"),
    R("Q-042", "gu", "vague", "રજા વિશે માહિતી આપો", "TOO_VAGUE", "no kind of leave named"),
    R("Q-043", "mixed", "vague", "salary ni vaat karo", "TOO_VAGUE", "no post or rule named"),

    # ── Gujarati documents (text read with guj+eng OCR) ──
    A("Q-044", "gu", "simple", "૨૬ નવેમ્બર ૨૦૨૦ના રોજ બંધારણના આમુખના વાંચનનો રાજ્ય સરકારનો કાર્યક્રમ સચિવાલયમાં ક્યાં યોજાશે?",
      [("1_2208", 1)], [["નર્મદા હોલ", "Narmada Hall"]], "Circular 19 Nov 2020: Narmada Hall, Swarnim Sankul-1, Sachivalaya"),
    A("Q-045", "en", "simple", "Where will the State Government's programme for the reading of the Preamble of the Constitution be held on 26 November 2020?",
      [("1_2208", 1)], [["Narmada Hall", "નર્મદા હોલ"]], "same page as Q-044 (English question about a Gujarati document)"),
    A("Q-046", "gu", "simple", "કોવિડ રસીકરણનું પ્રમાણપત્ર ન હોય તો સરકારી કચેરીમાં પ્રવેશ માટે શું માન્ય રહેશે?",
      [("1_2377", 1)], [["સ્વ ઘોષણા", "Self Declaration", "સ્વઘોષણા"]], "Circular 28 Feb 2022: self declaration is enough"),
    A("Q-047", "mixed", "simple", "Covid vaccine certificate na hoy to sarkari kacheri ma pravesh mate shu chalse?",
      [("1_2377", 1)], [["સ્વ ઘોષણા", "Self Declaration", "self-declaration"]], "same page as Q-046"),
    A("Q-048", "gu", "simple", "અધિકારી/કર્મચારીએ મુખ્યમથક છોડતા પહેલાં કોની પૂર્વ મંજુરી લેવી જરૂરી છે?",
      [("1_3869", 1), ("1_3871", 1)], [["વડાની પૂર્વ મંજુરી", "વડાની પૂર્વ મંજૂરી", "વડા"]], "Circular 9 May 2025 (repeated 13 May): prior approval of the head of department / office"),
    A("Q-049", "mixed", "simple", "Leave par hoy tyare officer ane employee e phone ane email par available rehvanu padse?",
      [("1_3871", 1)], [["ફોન", "phone"], ["ઈ.મેઈલ", "email", "e-mail", "ઈમેલ", "મેઈલ"]], "Circular 13 May 2025: 'ફોન/ઈ.મેઈલ પર સતત ઉપલબ્ધ રહેવાનું રહેશે'"),
    A("Q-050", "gu", "amended", "શું સરકારી અધિકારી/કર્મચારીઓની તમામ રજાઓ હાલમાં રદ છે?",
      [("1_3871", 1), ("1_3869", 1)], [["સક્ષમ સત્તાધિકારી", "સક્ષમ"], ["અનિવાર્ય સંજોગો", "અનિવાર્ય"]],
      "9 May 2025 circular cancelled all leave; the 13 May 2025 circular lets the competent authority grant leave and cancel it only in unavoidable "
      "circumstances. KNOWN GAP: the lineage engine does not link these two Gujarati circulars, so no status is shown for the 9 May one.",
      status=["amended", "superseded"]),
]


def resolve(short: str, corpus_ids: list[str]) -> str:
    hits = [g for g in corpus_ids if g.startswith(f"GR-{short}_")]
    if len(hits) != 1:
        raise SystemExit(f"document prefix {short!r} matches {len(hits)} documents: {hits[:3]}")
    return hits[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=ROOT / "eval" / "gold_questions.json")
    ap.add_argument("--allow-failures", action="store_true", help="write the file even if a key point is not on its page")
    args = ap.parse_args()
    corpus = {}
    for f in args.corpus.glob("GR-*.json"):
        r = json.loads(f.read_text(encoding="utf-8"))
        corpus[r["gr_id"]] = r
    ids = sorted(corpus)
    bad, out = 0, []
    for q in QUESTIONS:
        q = json.loads(json.dumps(q))                       # copy
        pages = []
        for d in q["gold_docs"]:
            d["doc_id"] = resolve(d["doc_id"], ids)
            pages.append(norm(" ".join(c["text"] for c in corpus[d["doc_id"]]["chunks"] if c["page"] == d["page"])))
        joined = "".join(pages)
        for kp in q["key_points"]:
            alts = [kp] if isinstance(kp, str) else kp
            if not any(norm(alt) in joined for alt in alts):   # every point needs at least one form that is on the cited page
                print(f"NOT ON PAGE  {q['question_id']}: {kp!r} -> {[d['doc_id'][:22] + ' p' + str(d['page']) for d in q['gold_docs']]}")
                bad += 1
        out.append(q)
    print(f"{len(out)} questions;", {c: sum(q['category'] == c for q in out) for c in ("simple", "amended", "superseded", "unanswerable", "vague")},
          {c: sum(q['language'] == c for q in out) for c in ("en", "gu", "mixed")}, "| key points not on the page:", bad)
    if bad and not args.allow_failures:
        return 1
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("written", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
