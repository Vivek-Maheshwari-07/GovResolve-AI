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
