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

## 2.2 Wrong-document answers: what was tried, what works, what does not
Measured on the 31 answers of the gold set (`eval/scorecard_full_v3.json`, citations recorded by a re-run). Of the 7 answers the scorer marks wrong, 3 are right answers it
cannot read (Q-005 date without the year, Q-009, Q-012 name spelled differently); **4 are genuinely wrong: Q-016, Q-021, Q-023, Q-050.** Only Q-023 cited another
document (the April 2007 amendment for a September 2007 question); Q-016, Q-021 and Q-050 cite the *right* GR and the model reads the wrong figure from it (Q-021 took the
notification date from the header, not the commencement date).

| Idea | Result |
|---|---|
| **Lexical support check**: do the question's rare words, numbers and dates occur in the cited document (sentence, page, title, number, date)? | **Rejected.** Question words like "how", "many", "did" are rare in GR text and swamp the score (right answers 0.25-0.5); with only numbers and month names it flags none of the 4 wrong answers and 1 right one. Removed, not shipped. |
| **Number words in the scorer** ("fifty percent" = "50 percent", "sixty three" = 63) | Kept. Answers with every key point 77.4% -> 80.6% on the saved run (Q-027). |
| **Second model call** "do the cited sentences answer the question?" (`ANSWER_CHECK`) | Built, **off by default**. With `qwen3.5:4b`: flags **2 of the 4** wrong answers (Q-016, Q-023, the wrong-document ones), misses Q-021 and Q-050, and also flags **2 of the 24** right ones (Q-022, Q-025). About 10 s per answer. |

`ANSWER_CHECK=off` (default) | `warn` (keep the answer, add a warning "A second check could not confirm that the cited passage answers this question") | `refuse`
(`insufficient_evidence`, `NO_DOCUMENT`). A reply that is neither yes nor no, or no model, never blocks an answer; a refusal by the model is not checked again.
Recommended: `warn` with a hosted model (one extra call of about a second, a stronger checker); not on the local CPU model. 4 genuinely wrong answers is a tiny sample: treat the
2/4 and 2/24 figures as an indication only. The remaining wrong answers (right document, wrong figure) need a stronger model, not a rule.

## 2.5 Speed and model decision (needs a hosted-model key: not run yet)
On the CPU, answers take a median 45 s (reading the evidence ~30 s, writing ~15 s, +5-12 s the first time a non-English question is translated); the 10 s target
needs a hosted model or a GPU. Nothing hosted has been measured yet: there is no key in `.env`. To run the comparison:
1. Get a key (free tiers: Groq or OpenRouter; check each service's current limits and model names). Put it in `.env` only, never in chat or git (`.env` is git-ignored):
   `LLM_PROVIDER=api`, `LLM_API_URL=...`, `LLM_API_KEY=...`, `LLM_API_MODEL=...` (examples in `.env.example`). The local model stays the automatic fallback.
2. `python -m scripts.llm_smoke` (from `backend/`): one tiny request per provider, prints OK/FAILED and seconds, never the key.
3. Full comparison on the 50 gold questions: `python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode full --out ../eval/scorecard_full_hosted.json`
   and compare with `eval/scorecard_full_v3.json` (local): median / p95 seconds, answered correctly (esp. Gujarati), wrongly refused, citations on the gold page.
4. With a fast model also try the bigger evidence budget (`EVIDENCE_MAX_CHARS=6000`, `EVIDENCE_CHARS_PER_CHUNK=1200`, `TOP_K_RERANK=5`) and `ANSWER_CHECK=warn` (2.2).
Questions and GR text are sent to the provider; the GRs are public documents, but check that the challenge rules allow an outside service. For an offline demo keep local Ollama
(and the model-free fallback, item 1.5) as the fallback.
