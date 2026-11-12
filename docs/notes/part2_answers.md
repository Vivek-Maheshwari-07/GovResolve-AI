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

Result on the 50 gold questions (35 answerable; the dev set the changes were made against, so treat the gain with care; `data/eval/scorecard_full_v3.json`):

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
Measured on the 31 answers of the gold set (`data/eval/scorecard_full_v3.json`, citations recorded by a re-run). Of the 7 answers the scorer marks wrong, 3 are right answers it
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
3. Full comparison on the 50 gold questions: `python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode full --out ../data/eval/scorecard_full_hosted.json`
   and compare with `data/eval/scorecard_full_v3.json` (local): median / p95 seconds, answered correctly (esp. Gujarati), wrongly refused, citations on the gold page.
4. With a fast model also try the bigger evidence budget (`EVIDENCE_MAX_CHARS=6000`, `EVIDENCE_CHARS_PER_CHUNK=1200`, `TOP_K_RERANK=5`) and `ANSWER_CHECK=warn` (2.2).
Questions and GR text are sent to the provider; the GRs are public documents, but check that the challenge rules allow an outside service. For an offline demo keep local Ollama
(and the model-free fallback, item 1.5) as the fallback.

## 2.3 Gujarati lineage: diagnosis (measured on the 134 Gujarati documents of `corpus_v2`; no engine change made)
Why the engine finds almost nothing in Gujarati (4 weak links, 139 unresolved references) and what it would take:
1. **The read list is never parsed (0 items in every Gujarati document tried).** A chunk is one long OCR paragraph, so "વંચાણે લીધા:- (૧)... (૨)... આમુખ... ઠરાવ:-" sits on one line, and
   `split_segments` / `parse_read_items` only recognise headings and numbered items at the *start of a line*. Without items, "cancel items 1 to 3" or "the resolution at reference (1)" cannot point anywhere.
2. **The guessed phrases do not match real wording.** `patterns.py` says its Gujarati phrases are unconfirmed. Seen in the corpus (documents / sentences): "અધિક્રમણ" (supersede) 0; the exact amend phrases 2 docs;
   "રદ કરવામાં આવે છે" 4; "ને બદલે" 10; "ના સ્થાને" 7. What the documents actually say: "…પરિપત્રો **આથી રદ કરવામાં આવે છે**" (cancel; targets are read-list items: "ક્રમાંક (૧) થી (૩) પરના", "વંચાણે લીધેલ **તમામ**"),
   "…પરિપત્રો **રદ કરીને બહાર પાડવામાં આવે છે**" (supersedes the preamble circulars), "**ઉક્ત સુધારા વધારા સિવાય** … સંદર્ભ (૧)માં દર્શાવેલ ઠરાવની તમામ બાબતો **યથાવત રહે છે**" (amends the resolution at reference 1),
   "…નિયમો, ૧૯૭૧ **સુધારવા** નીચેના નિયમો કરે છે" (rules amendment, target named by title, which the title matcher cannot read: it only knows Latin words), "**સમાનાંકી** પરિપત્ર" (the circular of the same number, a reference).
   The pointer regex needs the number right after "વંચાણે લીધેલ" but real text writes "ક્રમાંક (૧) થી (૩) પરના", "સંદર્ભ (૨) પરના", "ક્રમ-૩ અને ૪ ના", and OCR writes "ર" for "૨". Words like "સુધાર" (48 docs) and "રદ" (42 docs)
   are mostly noise for lineage ("rates revised", "amending the charges", "leave cancelled"), so matching them loosely would create false edges.
3. **Most targets are not in the corpus.** Only 30 of the 134 Gujarati documents have a readable read list with dates, and only 11 of those cite a date that matches a GR we hold (a few by coincidence). Examples: 2028 (2019) cancels GRs of
   2000-2004; the real in-corpus links (2025 Karmayogi LTC circular -> the Oct 2024 leave circulars; 2026 circular -> the three 26 Sep 2025 documents) are "in continuation of" references, not amendments.
   Expect roughly 6-10 new "related document" links and almost no new amended / superseded statuses from a perfect reader. That is why this was not built before the freeze.
4. **Q-050 cannot be met by explicit-text rules.** The 13 May 2025 circular relaxes the 9 May one with no amend/cancel verb ("ઉક્ત સૂચનાઓના અનુસંધાને ... રજાઓ મંજૂર કરી શકશે"); it cites it only as the "સમાનાંકી પરિપત્ર" in its read list. That is a reference
   (REFERS), and recognising it as a modification needs reading the meaning (a model), which the hard rules (explicit references only) rule out for the status.

If someone continues: (a) break inline markers and items in `split_segments` (insert a newline before "વંચાણે/વંચાણમાં લીધા", "આમુખ", "ઠરાવ:" and before "(n)" inside the read section, mapping "ર" to 2);
(b) Gujarati pointer forms incl. ranges ("(૧) થી (૩)"), "અને" lists and "તમામ" = all read items; (c) the phrases above, each tied to a pointer, date or number in the same sentence; (d) treat read-list items that match a corpus GR as REFERS;
(e) check every new edge by reading it, and keep the English gold pairs at P 1.000 / R 0.972. Roadmap item 2.3 is therefore deferred, with this note as its starting point.

## 2.4 The wrong Senior Clerk edge (fixed)
The 2020 Senior Clerk amendment was linked to the 1967 Recruitment Rules because the 1967 title appears inside the quoted text being substituted ("... as laid down in the
Gujarat Civil Services ... Rules, 1967"). `Resolver.match_title` now ignores text inside quotation marks (balanced pairs only; unbalanced OCR quotes leave the sentence as it was): a quoted title is inserted
wording, not the instrument being amended. Result on `corpus_v2`: the wrong edge is gone, gold pairs unchanged (69 of 71 found), precision 0.958 -> **0.972**, recall 0.972, no changing edges
outside the gold documents. Tests in `tests/test_resolve.py`.

## 2.6 Held-out set (16 questions, scored once, nothing tuned on them)
`data/eval/heldout_questions.json`, built by `scripts/make_heldout_questions.py`: 11 answerable (8 simple, 3 amended) + 5 refusals (3 absent topics, 1 legal-advice trap, 1 vague); en 8 / gu 5 / mixed 3.
All cited documents are ones no gold question uses (the builder and `tests/test_heldout_questions.py` check this), and every key point was verified on the cited page.
Drafted by Claude, **not officer-validated**. Saved runs: `data/eval/heldout_retrieval.json` (no model) and `data/eval/heldout_full.json` (local `qwen3.5:4b`, log in `data/eval/heldout_full.log`).
Run: `python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --gold ../data/eval/heldout_questions.json --mode full --out ../data/eval/heldout_full.json`

| | Held-out (11 answerable + 5 refusals) | Dev set (`scorecard_full_v3`, 35 + 15) |
|---|---|---|
| Right document first / first three | 72.7% / 72.7% | 82.9% / 94.3% |
| Answer in the evidence | 63.6% | 85.7% |
| Answerable questions answered correctly | **6 of 11 (55%)** | 24 of 35 (69%) |
| Answerable questions refused wrongly | 2 of 11 (H-003, H-004) | 4 of 35 (11%) |
| Answered wrongly or incompletely | 3 of 11 (H-008, H-009, H-011) | 4 genuinely wrong |
| Citations on the gold page / quote verbatim | 71.4% / 100% | 83% / 100% |
| Refusals correct, with the right reason code | 5/5 | 15/15 |
| Median / p95 seconds | 48 / 76 | 45 / 66 |

The scorer says 5 of 9 answers have every key point; reading them, **6 are right**: H-005 ("transfer the complaint to GAD immediately") is correct but the key point was "transferred to GAD".
What went wrong, by cause:
- **Wrong document (H-008, Gujarati):** the question names the GPSC member appointed on 29 Sep 2026 (Jyoti Iyer, `1_4065`); retrieval ranked the sibling gazette notices for other members (`1_4062`, `1_4063`) first and the model answered with their names. Plausible, verbatim-quoted and wrong: the dangerous kind.
- **Wrongly refused (H-003, H-004):** both are about Gujarati-text documents (`1_3801`, `1_3808`) that were not in the first three; the model said the sentences do not mention it.
- **Right document, answer not in the evidence (H-009):** the model named the amending rules instead of the Act that replaced entry 5.
- **Incomplete (H-011, Gujarati):** quoted the right paragraph but not "two examinations".
Conclusion: the dev-set numbers overstate what a new question gets. Expect roughly 55-65% fully correct on unseen questions with this local model, with refusals reliable and wrong-document answers the main risk (the hosted-model run, item 2.5, is the test of whether a stronger model fixes it). 16 questions is a very small sample.

## 2.5 Hosted-model test (Groq, `openai/gpt-oss-120b`, 2 Nov 2026; free tier)
Smoke test: reply in 0.9 s (`scripts.llm_smoke`). Model chosen because `llama-3.3-70b-versatile` is not available to this key; the key lists only `gpt-oss-20b/120b`, `qwen3.8-27b`, `allam-2-7b` for chat.
**The free tier allows 8,000 tokens per minute for this model**, so some requests get HTTP 429 and the gateway falls back to local Ollama *silently*. A hosted answer takes 1-8 s, a fallback 40-160 s,
so `seconds > 20` on an answered question marks a local answer. Runs on the 50 dev questions (answerable = 35); files in `eval/`:

| Run | Correct | Gujarati | Wrong / incomplete | Refused wrongly | Answers from local fallback | Clean? |
|---|---|---|---|---|---|---|
| Local only (`scorecard_full_v3`) | 24 | 5/11 | 7 | 4 | all | yes |
| Hosted, default budget (`scorecard_full_hosted`) | 26 | 7/11 | 3 | 6 | 3 | mostly |
| Hosted, `ANSWER_CHECK=warn` (`..._hosted_check`) | 26 | 6/11 | 3 | 6 | 0 | **yes** |
| Hosted, bigger evidence (`..._hosted_big`) | 31 | 9/11 | 1 | 3 | 7 | no |
| Same, paused 25 s between questions (`..._hosted_big2`) | 30 | 9/11 | 3 | 2 | 14 of 33 | no |

- **Clean hosted result:** 26/35 correct (vs 24 local), citations on the gold page 100% (vs 83%), refusals 15/15, 9-11 s per answer with the check on. Not a big step up for the default evidence budget.
- **Bigger evidence looks better (30-31/35) but is contaminated** by local fallbacks; the 25 s pause did not fix it (each question makes several calls). A clean number needs a higher rate limit (paid tier, another provider, a model with a bigger per-minute budget) or a pause of about 60 s.
- **Held-out set, hosted, default budget** (`heldout_full_hosted`): 5 of 11 by the scorer, 6 with the right answer the scorer misses (H-005); 4 refused (local: 2), H-008 still wrong; refusals 5/5. A stronger model did **not** fix the wrong-document answer or the Gujarati-document misses.
- **The hosted model is not deterministic**: with the same settings Q-009 and Q-044 were answered in one run and refused in another. The Phase 2.7 note "same question, same answer" holds for the local model only.
- `scripts.scorecard --pause N` waits N seconds after each question that called a model (for rate-limited tiers).
- Not done: a clean bigger-evidence run, the held-out set with the bigger budget, a larger-quota provider. `.env` is back on `LLM_PROVIDER=local` (key and model stay in it); the Groq key was pasted in chat once and should be rotated.
