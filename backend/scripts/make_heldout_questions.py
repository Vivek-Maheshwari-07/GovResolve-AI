"""Build eval/heldout_questions.json: questions about documents NONE of the 50 gold questions use (roadmap item 2.6).

Usage (from backend/):
    python -m scripts.make_heldout_questions --corpus D:/test/corpus_v2 [--out ../eval/heldout_questions.json]

Same rule as make_gold_questions: an answerable question is written only if every key point occurs on the cited page.
These questions were written AFTER the Part 2 changes were frozen, so the system was never tuned on them. Score them once
(`scripts.scorecard --gold ../eval/heldout_questions.json`) and do not change the system to fit what they show; if a fix is made
anyway, say so next to the number. Drafted by Claude from the document text; NOT officer-validated.
"""
import argparse
import json
import sys
from pathlib import Path

from scripts.make_gold_questions import A, R, resolve
from scripts.scorecard import ROOT, norm

QUESTIONS = [
    # ── answerable: documents not used by Q-001..Q-050 ──
    A("H-001", "gu", "simple", "તા. ૧-૪-૨૦૧૬ પછી ચાલુ નોકરી દરમ્યાન અવસાન પામનાર વર્ગ-૩ અને વર્ગ-૪ના કર્મચારીના આશ્રિત કુટુંબને કેટલા લાખની ઉચ્ચક નાણાકીય સહાય મળે છે?",
      [("1_1719", 1)], [["૮ (આઠ ) લાખ", "આઠ", "8 લાખ", "8 lakh"]], "Resolution 7 Apr 2016: lump sum raised to Rs 8 lakh"),
    A("H-002", "gu", "simple", "સચિવાલયના સંયુક્ત સચિવો અને નાયબ સચિવોને મોબાઇલ ફોનની સુવિધામાં માસિક એર ટોક ટાઇમની મર્યાદા કેટલી મંજૂર થઈ?",
      [("1_1730", 1)], [["૫૦૦", "500"]], "Resolution 29 Apr 2016: air talk time limit Rs 500 a month, no handset"),
    A("H-003", "en", "simple", "Which monthly payment limit for outsourced stenographers was removed by the June 2024 resolution, and what replaced it?",
      [("1_3801", 1)], ["15000", ["minimum wage", "લઘુત્તમ વેતન"]], "Resolution 11 Jun 2024: Rs 15,000 limit removed; minimum wage of skilled workers applies"),
    A("H-004", "mixed", "amended", "Class-4 karmchario na uniform kapad na bhav ni july 2024 ni spashtata ma 'pratī set' ni jagyae shu vanchvanu che?",
      [("1_3808", 1)], [["બે જોડી", "two pairs", "be jodi"]], "Resolution 24 Jul 2024: 'પ્રતિ સેટ' to be read as 'બે જોડી માટે'"),
    A("H-005", "en", "simple", "What must a Secretariat department do if it receives a complaint against an IAS officer?",
      [("1_780", 1)], ["transferred to GAD"], "Circular 9 Jan 2009: no direct dealing; transfer the complaint to GAD forthwith"),
    A("H-006", "en", "simple", "How is the pay fixed for a retired AIS officer appointed on contract under the June 2004 circular?",
      [("1_738", 1)], ["Last Pay Drawn minus Pension"], "Circular 24 Jun 2004, term (1)"),
    A("H-007", "mixed", "simple", "Retired AIS officer ne contract par rakhya hoy to darek varsh ma ketla divas ni paid leave made?",
      [("1_738", 2)], [["15 days", "15 divas", "15"]], "Circular 24 Jun 2004, term (7): 15 days' paid leave per completed year"),
    A("H-008", "gu", "simple", "૨૯ સપ્ટેમ્બર ૨૦૨૬ના જાહેરનામાથી ગુજરાત જાહેર સેવા આયોગના સભ્ય તરીકે કોની નિમણૂક કરવામાં આવી?",
      [("1_4065", 2)], [["Jyoti Iyer", "જ્યોતિ ઐયર", "જ્યોતિ અય્યર"]], "Gazette 29 Sep 2026: Prof. (Dr.) Jyoti Iyer"),
    A("H-009", "en", "amended", "Which Act replaced the entry at serial no. 5 of Paper II (Service Matters-2) by the May 2026 amendment of the Section Officer, Class-II Departmental Examination Rules?",
      [("1_4029", 2)], ["Right of Citizens to Public Services"], "Gazette 1 May 2026: entry 5 replaced by 'The Gujarat (Right of Citizens to Public Services) Act, 2013'"),
    A("H-010", "en", "amended", "What assistance may a Government servant take to present the case on his behalf, according to the 1986 amendment of the Gujarat Civil Services (Discipline and Appeal) Rules, 1971?",
      [("1_3916", 1)], ["retired Government"], "Notification 16 Apr 1986: note added after rule 9(5)(c); OCR of this scan is poor"),
    A("H-011", "gu", "simple", "ધોરણ-૧૦ અને ૧૧નો અભ્યાસક્રમ બદલાય ત્યારે હિન્દી ભાષા પરીક્ષામાં નાપાસ થયેલા ઉમેદવારો જૂના અભ્યાસક્રમ મુજબ કેટલી પરીક્ષાઓ આપી શકશે?",
      [("1_2232", 1)], [["બે પરીક્ષા", "બે પરીક્ષાઓ", "two"]], "Resolution 13 Oct 2004: old syllabus allowed for the next two examinations"),

    # ── unanswerable: topic absent from the corpus (text search: 0 of 366 documents) ──
    R("H-012", "en", "unanswerable", "How many days of child care leave can a woman government employee take?", "NO_DOCUMENT",
      "text search: 0 documents mention child care leave / બાળ સંભાળ"),
    R("H-013", "gu", "unanswerable", "ગુજરાતમાં ડ્રાઇવિંગ લાયસન્સ રિન્યુ કરવાની ફી કેટલી છે?", "NO_DOCUMENT", "text search: 0 documents mention driving licences"),
    R("H-014", "mixed", "unanswerable", "Students ne scholarship ketli madse?", "NO_DOCUMENT", "text search: 0 documents mention scholarship / શિષ્યવૃત્તિ"),
    R("H-015", "en", "unanswerable", "Should I file a case in court against my transfer order and will the court cancel it?", "OUT_OF_SCOPE",
      "asks for legal advice and a prediction"),
    R("H-016", "en", "vague", "pension", "TOO_VAGUE", "one word, no rule or person named"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=ROOT / "eval" / "heldout_questions.json")
    ap.add_argument("--gold", type=Path, default=ROOT / "eval" / "gold_questions.json")
    ap.add_argument("--allow-failures", action="store_true")
    args = ap.parse_args()
    corpus = {}
    for f in args.corpus.glob("GR-*.json"):
        r = json.loads(f.read_text(encoding="utf-8"))
        corpus[r["gr_id"]] = r
    ids = sorted(corpus)
    used = {d["doc_id"] for q in json.loads(args.gold.read_text(encoding="utf-8")) for d in q["gold_docs"]}
    bad, out = 0, []
    for q in QUESTIONS:
        q = json.loads(json.dumps(q))
        pages = []
        for d in q["gold_docs"]:
            d["doc_id"] = resolve(d["doc_id"], ids)
            if d["doc_id"] in used:
                print(f"USED BEFORE  {q['question_id']}: {d['doc_id'][:30]} is a gold-set document")
                bad += 1
            pages.append(norm(" ".join(c["text"] for c in corpus[d["doc_id"]]["chunks"] if c["page"] == d["page"])))
        joined = "".join(pages)
        for kp in q["key_points"]:
            alts = [kp] if isinstance(kp, str) else kp
            if not any(norm(alt) in joined for alt in alts):
                print(f"NOT ON PAGE  {q['question_id']}: {kp!r} -> {[d['doc_id'][:22] + ' p' + str(d['page']) for d in q['gold_docs']]}")
                bad += 1
        out.append(q)
    print(f"{len(out)} questions;", {c: sum(q['category'] == c for q in out) for c in ("simple", "amended", "unanswerable", "vague")},
          {c: sum(q['language'] == c for q in out) for c in ("en", "gu", "mixed")}, "| problems:", bad)
    if bad and not args.allow_failures:
        return 1
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("written", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
