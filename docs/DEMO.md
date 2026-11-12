# Demo scenarios (roadmap item 2.7)

Five scenarios that together show what the spec asks for: grounded answers with page and quote, amendment/supersession status, Gujarati and mixed questions,
and an honest "I cannot tell". Every answer below was produced by the saved scorecard runs (`data/eval/scorecard_full_v3.json`, local `qwen3.5:4b`); nothing is invented for the demo.

**Setup for the demo** (from the repo root; details in `backend/README.md`):
```bash
python run.py        # or double-click start.bat
```
It finds the real corpus and index, answers through the RAG pipeline and opens http://localhost:8000 (the web UI: answer, citation chips, the PDF page with the cited paragraph boxed, lineage tab).
Ollama must be running (`qwen3.5:4b`, `bge-m3`). Allow **40-70 s per answer** on this CPU; ask the first question before the audience arrives (it loads the model).
Scenario 5c uses the synthetic fixtures: stop the app and, from `backend/`, run `python -m uvicorn app.main:app --port 8001` (default settings = fixtures, search without a model) and open http://localhost:8001.

| # | What it shows | Question (ask it as written) | What the system says | Where to look |
|---|---|---|---|---|
| 1 | Plain English question, quote and page (gold Q-009) | "From which date did the new mobile phone tariff for government use apply, and whose offer was accepted?" | "The new tariff applied from 1st October 2015. Vodafone West Limited's offer was accepted." | Citation: GR of 15 Oct 2015, page 1, verbatim sentence, box on the PDF page |
| 2 | An explicit amendment is found (Q-019) | "By how much was the upper age limit relaxed for direct selection under the Gujarat Civil Services Classification and Recruitment (General) Rules, 1967, in 2022?" | "relaxed by one year", cited to the 29 Sep 2022 notification (new rule 16H) | Statement label `established`; open the lineage of the 1967 rules: base + its amendments in date order (a timeline, not a chain: every amendment here amends the base directly) |
| 3 | Gujarati question about a Gujarati document (Q-044) | "૨૬ નવેમ્બર ૨૦૨૦ના રોજ બંધારણના આમુખના વાંચનનો રાજ્ય સરકારનો કાર્યક્રમ સચિવાલયમાં ક્યાં યોજાશે?" | Answer in Gujarati: Narmada Hall, Swarnim Sankul-1 | Slowest (66 s in the saved run). The same question in English (Q-045) is **refused** in the saved run: do not show that one live |
| 4 | Mixed-language question (Q-010) | "Government na mobile phone mate navo tariff kya divas thi lagu thayo ane kai company ni offer swikari?" | "Vodafone West Limited ... Tariff 1st October, 2015 se lagu thayo." | The answer follows the question's language and is cited to the same GR as scenario 1 |
| 5 | Refusals and a superseded order | (a) "How many days of maternity leave are allowed to women government employees?" (b) "Can I sue the department for wrongly denying my promotion and will I win?" (c) with the **fixtures**: the question "ખેડૂતોને પાક નુકસાન સહાય" | (a) refuses, `NO_DOCUMENT`, "the provided sentences do not mention maternity leave" (0 of 366 documents mention it). (b) refuses at once, `OUT_OF_SCOPE`, no model call. (c) answers, with the warning "AGR-2012-03 is superseded (Superseded by AGR-2018-11 dated 2018-05-12); this passage may no longer apply." | (c) shows status `superseded` on the 2012 order and the superseding order named as the one to read |

## Say this out loud (honest limits)
- The real corpus (`corpus_v2`) has **no superseded order**: all links in it are amendments or references. Scenario 5c uses synthetic fixture documents (`data/fixtures`, written for the tests) and says so.
- Nothing ever says "active". A document with no later order shows `no_later_amendment_found`: that means "none in these 366 documents", not "in force".
- On 16 questions it had never seen the system answered **6 of 11 correctly** (5 of 5 refusals correct). On the 50 development questions it was 24 of 35. See `data/eval/SCORECARD_SUMMARY.md`.
- Gujarati lineage barely works (4 weak links found in 134 Gujarati documents), so a Gujarati amendment is usually **not** flagged. Gold Q-050 (the 13 May 2025 relaxation of the 9 May 2025 leave circular) shows this.
- Without a model (Ollama stopped) the system quotes one passage and warns that it is not a written answer; for an unanswerable question that passage can be unrelated.
- Wording varies: in the first live UI test of scenario 1 the answer read "The new tariff applied from 01-10-2015 based on M/s.'s accepted offer" (the company name was dropped; the cited passage on the PDF names Vodafone West Limited). Point at the passage, not the sentence.
- A wrong-document answer is possible and looks convincing (held-out H-008 named other GPSC members). Always read the cited quote.

## Not for the live demo
Q-021 (Gujarati, rules in force from which date: gives the notification date), Q-023 (April 2007 amendment's dates for the September 2007 question), Q-016, Q-050: genuinely wrong. Q-045 and Q-001: wrongly refused.
