# Scorecard summary (as of 2 Nov 2026)

All runs use the local model `qwen3.5:4b` through Ollama. Hosted-model numbers are **not yet measured** (see "Not measured").
Gold questions are drafted by Claude from the document text and are **not officer-validated**.

## Two question sets
- **Dev set**: 50 questions (`gold_questions.json`; 35 answerable, 15 refusals). The retrieval and evidence code was tuned against it, so its numbers are optimistic.
- **Held-out set**: 16 questions (`heldout_questions.json`; 11 answerable, 5 refusals) on documents the dev set never uses. Written after the changes were frozen and scored once.

## Results

| Metric (spec criterion) | Dev set (`scorecard_full_v3.json`) | Held-out (`heldout_full.json`) |
|---|---|---|
| Correct document first / in first three | 82.9% / 94.3% | 72.7% / 72.7% |
| Citation on the gold page | 83.0% | 71.4% |
| Quote verbatim on its page | 100% | 100% |
| Answerable questions answered correctly | 24 of 35 (69%) | 6 of 11 (55%) |
| Answerable questions wrongly refused | 4 of 35 | 2 of 11 |
| Unanswerable / vague questions refused, right reason code | 15 of 15 | 5 of 5 |
| Amendment pairs vs 71 verified gold pairs | precision 0.972, recall 0.972 | (same graph) |
| Median / p95 seconds per answer | 45 / 66 | 48 / 76 |

Answer counts are after reading the answers: the automatic scorer misses right answers worded differently (3 on the dev set, 1 held-out).

## Honest notes
1. The held-out numbers are the better guide to what a new question gets: about 55-65% fully correct with this model. 16 questions is a tiny sample.
2. Quotes are never invented (100% verbatim on both sets) and refusals are reliable (20 of 20). Errors are a wrong document or a wrong figure read from the right document, with a correct-looking quote.
3. Amendment status comes only from explicit references. The pairs score is on English documents; Gujarati lineage is a known gap (`docs/notes/part2_answers.md`, 2.3).
4. The corpus has no superseded document. The `superseded` status is shown on synthetic fixtures only.
5. Latency is 45-75 s on this CPU. The 10 s target needs a hosted model or a GPU.
6. The dev numbers rose during Part 2 (answered correctly 11 -> 24 of 35) through retrieval and evidence changes, each tuned on those 50 questions.

## Not measured
- Hosted model (Groq `openai/gpt-oss-120b`, free tier): measured, see `docs/notes/part2_answers.md` section 2.5. The one clean run (`ANSWER_CHECK=warn`) answered 26/35 correctly (local 24/35), citations on the gold page 100%, 9-11 s per answer; the bigger-evidence runs (30-31/35) are mixed with local fallbacks after rate-limit errors, so a clean number needs a higher quota. Held-out set on the hosted model: about 6 of 11, no better than local.
- Officer validation of the gold questions and the lineage pairs (`gold_lineage_verified.csv`) is pending.
- The final full scorecard for the submitted build has to be re-run after the UI branch (`part1-impl`) is merged.

## Everyday-wording questions (27 Nov 2026, `naive_questions.json`, 34 questions)
Written the way a clerk or a citizen would type them (English, Hinglish, Gujlish, Gujarati), not officer-validated: 17 have an answer in the collection
(expected document taken from the verified gold question), 5 are not covered, 8 are open-ended (`unknown`, read by hand), 4 are one-word questions.
Run with `python -m backend.scripts.naive_eval` against a server started with `ANSWER_CACHE=`; results in `naive_scorecard_<label>.json`. Hosted model (Groq).

| | Everyday-wording set |
|---|---|
| Answerable questions answered from the expected document | 6-7 of 17 (two runs of the same build; the model is not deterministic, so +-1 is noise) |
| Answerable questions refused (`NO_DOCUMENT`) although the document exists | 8 of 17 |
| Answerable questions answered from another document | 2-3 of 17 |
| Not-in-collection questions answered | 0 of 5 (all refused) |
| One-word questions: `TOO_VAGUE` with questions to click | 4 of 4 |
| Refusals that name the closest resolutions | 19 of 23; the right document is among them in 2 of 8 refusals of answerable questions |
| Median seconds per answer | 2.2-3.6 |

Honest reading:
1. On everyday wording the app answers about 40% of the questions it could answer, against 69% on the officer-style dev set. The rest are mostly refused, not answered wrongly.
2. The query rewrite (`QUERY_REWRITE=on`) did not help (6 vs 7 of 17, within noise) and turned two open-ended refusals into answers that look wrong
   ("salary kitni badhegi" -> a pay scale of one post; "transferred to my home town" -> a Home Town LTC rule). It is therefore off by default.
3. Pointers to the closest resolutions were first accepted on any shared word and then needed two uncommon words. The stricter rule removed pointers for
   "bike loan", "income tax" and "driving licence", and also lost the right document in half of the cases where it had been found (4 of 8 -> 2 of 8).
4. 8 open-ended questions: 6 refused, 2 answered from a resolution that may not be the right one (promotion of a clerk, travelling allowance); neither is verified.
