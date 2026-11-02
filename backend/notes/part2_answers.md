# Part 2 notes (answers and data): items done on branch `part2-answers`

## 1.4b Citation boxes
`/query` citations now carry `bbox` = `[x0, y0, x1, y1]` in **PDF points, origin at the top-left of the page**, on the citation's own `page`
(the same units PyMuPDF and PDF.js report at scale 1). It is the box of the *paragraph* (chunk) the quoted sentence sits in, so the highlight is coarse,
not the exact line. `bbox` is `null` when the chunk has no box. Checked on real PDFs: the quoted text lies inside the box in every case tried.
Code: `RAGPipeline._chunk_box`, sentence registry `bbox`, `Citation(bbox=...)`; the bridge already turned it into `[x0, y0, x1, y1]`.

## 1.5 Answer without a language model
When no model answers (offline, unreachable, no key) `/query` returns the single best-matching evidence sentence, verbatim, with:
- the citation (and box), one statement labelled `inferred` (nobody checked it answers the question),
- a warning in `warnings`: "The language model is unavailable ... not a written answer ...". The UI must show it next to the answer.
Engine warnings now flow through `EngineResult.warnings` into the response `warnings` (one line in `app/main.py::query`).
If no passage has at least `EXTRACTIVE_MIN_COVERAGE` (0.2) of the question's rare words, it refuses with `NO_DOCUMENT`.

**Limit (measured):** word overlap cannot tell answerable from unanswerable questions (on the 50 gold questions the best sentence scored 0.14-0.66 for
answerable and 0.20-0.58 for unanswerable ones), so offline an unanswerable question can still get an unrelated quote, flagged by the warning.
The guards (vague, legal advice) still refuse offline; the floor only removes zero-signal matches. A model is needed to say "no".

## Try it
- Offline check: `LLM_PROVIDER=local LOCAL_LLM_URL=http://127.0.0.1:9/v1/chat/completions` and ask any question.
- Tests: `tests/test_citation_box_and_fallback.py`, and `sentence_coverage` in `tests/test_squad2_injection.py`.

## 2.1 Cross-lingual retrieval (English rendering of Gujarati and Gujlish questions)
`RAGPipeline.prepare(question)` builds the search bundle. For a question that is not English (Gujarati, Gujarati in Latin letters, or mixed) it asks the
model for one short English rendering (`llm_gateway.translate_to_english`, plain text, 80 tokens, 5-12 s on this CPU) and puts it in `bundle.query_en` and its
words in `bundle.keywords`. The original Gujarati channels stay, so a bad rendering cannot remove what worked before. The same words are used to choose the
evidence sentences (`build_evidence(question, passages, bundle)`), because a Gujarati question shares no words with an English document.
- Remembered in memory and in `data/index/translations.json` (git-ignored; `TRANSLATION_CACHE=` with an empty value turns the file off): a question costs one
  model call ever. **A new non-English question therefore costs 5-12 s extra the first time**; the scorecard runs below had a warm cache, so their latency
  does not include it.
- No model, or a reply that is not English: nothing changes, the bundle is the one built without translation.
- Bug found on the way: the gateway forced JSON output for the local model whenever the URL did not contain "ollama", so every first translation came back as
  `{"answer": ...}` or empty and was rejected (13 of 15). Plain-text mode (`json_mode=False`) is now asked for here; answers keep JSON mode.
- Tests never call a model: `tests/conftest.py` switches the pipeline's translation off, and `tests/test_cross_lingual.py` switches it back on with a fake model.

Result on the 50 gold questions (35 answerable; the dev set the changes were made against, so treat the gain with care; `eval/scorecard_full_v3.json`):

| | Before (`scorecard_full_v2`) | After (`scorecard_full_v3`) |
|---|---|---|
| Right document first / in the first three | 65.7% / 82.9% | **82.9% / 94.3%** |
| Answer in the evidence (en / gu / gujlish) | 77.1% (87 / 73 / 67) | **85.7% (87 / 73 / 100)** |
| Answerable questions answered correctly | 19 (54%) | **24 (69%)** |
| Answerable questions refused wrongly | 10 (29%) | **4 (11%)** |
| Answered correctly: English / Gujarati / Gujlish | 12/15, 3/11, 4/9 | 12/15, **5/11**, **7/9** |
| Citations on the gold page / quote verbatim | 76.3% / 100% | **83.0%** / 100% |
| Answers with every key point (of those given) | 76% (19/25) | 77% (24/31) |
| Refusals correct, with the right reason code | 15/15 | 15/15 |
| Median / p95 seconds per answer | 36 / 66 | 45 / 66 (cache warm) |

Eight questions changed: Q-008, Q-010, Q-018, Q-028, Q-047 went from refused to right, Q-044 from wrong to right; two got worse: **Q-021** (Gujarati, "from which date do the
2006 rules apply") is now wrong (the model gave the notification date 2006-09-30, not 1 October) and **Q-023** went from refused to a plausible wrong answer (the April 2007
amendment's dates for the September 2007 question). English is unchanged. Still missing the answer in the evidence: Q-001, Q-045 (English, answer chunk too far down),
Q-016, Q-021, Q-050 (Gujarati; Q-050 is the known Gujarati-lineage gap).
