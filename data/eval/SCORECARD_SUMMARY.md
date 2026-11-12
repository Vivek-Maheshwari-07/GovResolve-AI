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
