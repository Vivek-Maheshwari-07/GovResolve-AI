# Squad 3 implementation plan and Phase 1 findings

Read `../AGENTS.md` and `API_CONTRACT.md` first. Code map: `app/` (document graph + contract endpoints: Member A),
`app/lineage/` (clause-level engine, router, store: Member B), `scripts/`, `tests/`, `../data/fixtures/` (synthetic GRs),
`../eval/gold_lineage.csv` (13 synthetic gold edges).

Hard rules: edge direction newer -> older; never output an "active" status; only explicit references create edges;
quotes are verbatim; do not rename or remove API fields (frozen after Nov 2); run `python -m pytest` before finishing.

## Phases (code freeze Nov 5)
1. Real-data validation (Nov 1-2): this document.
2. Gold edges and pattern fixes (Nov 2-3).
3. Integration with Squad 2 (Nov 3-4).
4. Hardening and demo (Nov 4-5).

## Phase 1: running the engine on real GRs
Data: `final_dataset/` (outside git; see its `DATA_CARD.md`). Conversion: `python -m scripts.pdf_to_gr_json
--manifest ../final_dataset/manifest.csv --root ../final_dataset --out D:/test/gr_json`, then
`python -m scripts.build_lineage --corpus D:/test/gr_json --out D:/test/gr_json_edges.csv`.

Result on the 247 core GAD text-layer files (194 English, 53 Gujarati):

| Item | Result |
|---|---|
| Records converted | 247 of 247 |
| Metadata filled | department 247 (default from folder), issue_date 122, gr_number 109, subject 1 |
| Edges | 127: REFERS 122, SUPERSEDES 2, SUBSTITUTES 2, CLARIFIES 1 |
| Edges with a target in the corpus | 5, all REFERS (so no document got a changed status) |
| Broken links | 122 (references to GRs we do not hold) |
| Sentences flagged for manual review | 878 |
| Cycles | 0 |

### Failures to fix (Phase 2 input)
1. **The core corpus holds almost no resolvable amendment chains.** Amending texts cite GRs we do not have.
   Fix: run on all 873 text-layer PDFs in the archive and pick chains from what resolves.
2. **Chain candidates from date matching are mostly false.** Of the 14 pairs, most are sibling notifications
   issued the same day citing their own date. Plausible ones: the DDO-Headquarter circulars (2018) and
   the 1_1495 -> 1_1363 ministers notification (2014). Review these by hand.
3. **Garbled Gujarati text layers.** Of 64 Gujarati-bearing files, 7 are clearly garbled and 26 doubtful
   (example: `ચનયમ` for `નિયમ`, `઩રય઩ત્ર`). Patterns cannot match this. Send these files through OCR (`guj`).
4. **Targets named by rule, not by GR number.** Rule amendments ("in the Gujarat Ministers Travelling Allowance Rules,
   1983 ... shall be substituted") produce SUBSTITUTES edges with the clause as the target and no resolved GR.
   Add a named-instrument resolver (rule/act name + year -> GR).
5. **Unresolved SUPERSEDES targets.** `GU/2016/38/MIS/102016/395/D` is extracted correctly but the GR is not in
   the corpus (a true broken link; it must surface as `BROKEN_CHAIN`).
6. **"reference without phrase" noise.** Most of the 878 review items are letterhead numbers and distribution lists
   ("Circular No. CON1062/2961-C"), not citations. Filter by position (first lines, "Copy to").
7. **Missed phrasing.** Review items show "hereby repealed", "continue in force until modified or rescinded",
   and "shall be substituted" with no resolvable target. Classify them (CANCELS vs. mere mention).
8. **Metadata extraction is weak.** `subject` is almost never found (no "Subject:" label in these GRs);
   gr_number needs per-format rules; issue_date takes the first date on page 1 (can be a referenced date).
9. **Chunking is block-level.** Section markers (Read / Preamble / Resolution) are found inside chunks by the engine,
   so this works, but clause labels are only set when a block starts with a number.

## Phase 2 (in progress): archive run and precision fixes
Archive run: `python -m scripts.pdf_to_gr_json --pdf-dir D:/test/dataset_organized --out D:/test/gr_json_all` converts every unique
text-layer PDF (813 of 3,572; 2,759 were scanned, duplicate or unreadable), then `build_lineage` on that folder.

| | 247 core files | 813 archive files (after fixes) |
|---|---|---|
| Edges | 127 | 238 (REFERS 229, SUPERSEDES 4, CANCELS 2, SUBSTITUTES 2, CLARIFIES 1) |
| Resolved non-REFERS edges | 0 | 0 |
| Documents with a changed status | 0 | 0 |

Fixes made (all with tests, 194 passing):
- **Own number as target.** A notification's own header number (`No. GU/2025/20/IMD/WRT/e-file/...:-`) was read as a
  supersession target. The number pattern stops at lowercase parts, so the printed number is a prefix of ours. Own-number
  check now accepts prefixes, and any number directly before the `:-` leader is treated as the document itself.
- **Wrong-year matches.** `KP/51 of 2014` resolved to a different `KP/51` issued in 2025. Numbers now carry the year from
  `of YYYY` and only resolve to a GR issued that year or the next. The resolver keeps every GR sharing a printed number.
  This removed the only (false) AMENDED document and 5 false edges.

Tried and reverted: footnote handling for consolidated texts ("Inserted vide GN ... dated ..."). The consolidated text is issued
after the notifications it lists, so an edge between them would break the newer -> older rule. Needs a new relation (for example
INCORPORATES) in the contract, which is not possible after the freeze.

### Blocker for the 30+ gold edges
Mining the corpus for real chains finds none that resolve inside it. Named-rule matching ("further to amend the X Rules, 2006")
gives 6 candidates, and the plausible ones amend a base instrument we do not hold (for example the Ministers' Travelling
Allowances Rules, 1983, amended in 2022 and 2025). Gold edges therefore have to come from a deliberate search:
1. Pick 8-10 rule families whose base instrument and amendments are all on the portals (recruitment rules, travelling allowance,
   computer competency rules, leave rules) and download the missing ones.
2. OCR the scanned ones in those families (guj+eng).
3. Read each amendment and write the edge by hand with the verbatim sentence as evidence.

### Phase 2 update: rule families, OCR and named-instrument matching
- **10 rule families** (91 documents, all already in the archive) are listed in `final_dataset/rule_families.csv`, found from the
  portal listing titles. 82 are scanned: `python -m scripts.ocr_to_gr_json --families ../final_dataset/rule_families.csv
  --pdf-root D:/test/dataset_organized --out D:/test/gr_json_families` OCRs them (Tesseract `eng`, 300 DPI; mean word confidence
  0.85, 14 documents below 0.80). Issue date, number and subject come from the portal listing, not from OCR.
- **Named-instrument matching** (new): amendments say "further to amend the <Rules title>" with no GR number. `Resolver.match_title`
  matches the sentence (plus its neighbours, since OCR splits titles at colons) against the titles of base instruments in the corpus
  (85% of title words, at least 5), earliest GR wins, amendments and "updated" copies are never targets. Edges are PROBABLE.
  Added the phrase "further to amend" to the AMENDS patterns. 195 tests pass.
- **Result on the families corpus:** 222 edges, 8 documents now AMENDED (was 0). `eval/gold_lineage_real.csv` holds 72 amendment -> base
  pairs derived from the portal listing (every listed amendment of a family's base rules). Pair-level score of the engine:
  precision 0.96 (51 of 53), recall 0.71 (51 of 72). The gold is NOT yet hand-checked against the document text: a teammate must
  open each amendment and confirm, then fix the notes column.
- Known misses (21): OCR too noisy for the title (confidence under 0.6), titles with the year or a rule number replacing the words,
  amendments whose base we do not hold (F07 Discipline and Appeal 1971, F09 2014-2015 amendments), and one false positive each from
  a consolidated copy and a clerk recruitment rule that mentions the classification rules.

### Phase 2 follow-up: the 21 missed amendments
Full per-miss table (source PDF, page, amendment wording, reason, whether fixable): `eval/miss_analysis.csv`.
Causes of the 21: sentence cut at an OCR block boundary, or title straddling sentence splits (14); own header number taken as the
target, which blocked the title match (3); relation phrase split or garbled by OCR (1); Gujarati-language scan (1); title too garbled
by OCR (1); portal title differs from the rule's own title (1). 18 are fixed, 3 remain (the last three causes). Fixes (no API change): merge blocks that stop mid-sentence when
converting; read a rule-making notification from "In exercise of the powers" onwards (the header number is the document itself);
title window = sentence up to the phrase plus 300 characters after it (never the previous sentence, except across ':' / ';' cuts);
title words must appear in order within a short stretch and may have one or two OCR slips (edit distance); a blanket repeal
("in supersession of all the rules") names nothing; "further to amend" tolerates OCR slips and a stray `|`.

| Pair-level, 72 portal-derived gold pairs | precision | recall | F1 |
|---|---|---|---|
| Before (commit 3abaf83) | 0.962 (51/53) | 0.708 | 0.816 |
| After | 1.000 (69/69) | 0.958 | 0.979 |

Caution: the fixes were designed while looking at these same 72 pairs, and the gold is derived from the portal listing and not yet
checked against the documents, so treat the numbers as a development score. The 813-document archive and the 247 core files still
give 0 resolved changing edges (no false ones appeared). Remaining misses: 1_3491 (Gujarati scan), 1_3685 (OCR title too garbled),
1_3322 (portal title differs from the rule title).

## Roadmap Phase 1 (Nov 1, `integration` branch): demo corpus v1
Build: `python -m scripts.build_corpus --manifest ../final_dataset/manifest.csv --root ../final_dataset
--sources ../final_dataset/SOURCES_full_per_file_urls.txt --families-json D:/test/gr_json_families --out D:/test/corpus_v1`
(about 10 min, 8 workers). Per-record text source and scores: `corpus_v1/corpus_report.csv`.

| | count |
|---|---|
| Records (91 rule-family + 238 core + 37 Gujarati from other tiers, de-duplicated) | 366 |
| Chunks | 7,395 |
| Subject filled (portal `ROW:` listing, else `Subject:`/`વિષય:` label) | 324 (88.5%, was 1/247 on core) |
| GR number filled | 355 (97%, was 109/247) |
| Gujarati documents OCR'd with `guj+eng` and kept because OCR scored higher | 88 of 90 |

- **Most Gujarati text layers are lossy, not just 7 + 26.** Two failure modes: legacy-font remapping (`વાભાન્મ લશીલટ` for
  `સામાન્ય વહીવટ`, unassigned code points) and dropped conjuncts / misplaced vowel signs (`કમ ચારીઓ` for `કર્મચારીઓ`), even in
  the best files. Score = share of very common Gujarati words spelled correctly; OCR beat the text layer on 88/90, no file stays
  below 0.05. Five spot-checked OCR records read correctly (mean word confidence 0.90-0.94).
- Backend on corpus_v1: 366 documents load in 35 s, 377 edges (131 amends, 6 supersedes, 3 cancels, 237 refers_to),
  10 documents `amended`, 0 `superseded`, 0 cycles, 255 references to GRs outside the corpus. Fixed on the way: Chroma rejected
  the 7,395-chunk upsert (max 5,461), now batched.
- Lineage did not regress: pair-level on the 72 gold pairs is still P 1.000 (69/69), R 0.958 for both the families-only set and
  corpus_v1. Note `scripts.eval_lineage` scores (source, target, relation) and gives P 0.62 / R 0.90: the relation type often
  disagrees with the gold (AMENDS vs SUBSTITUTES on the same pair), to settle during hand verification (roadmap 3.1).
- 8 new PROBABLE changing edges run from core documents into family documents (e.g. `1_3906` 2025 gazette -> `1_3252`, both
  AMENDS and SUBSTITUTES). Candidates for the gold; not yet checked.
- Squad 2 index: `python -m scripts.build_squad2_index --corpus D:/test/corpus_v1` with `EMBEDDING_MODEL=ollama:bge-m3`.
  bge-m3 on this CPU embeds about 1.4 chunks/s, so the first build takes about 90 min (re-runs add only missing chunks).

Index built (Nov 1): 7,395 of 7,395 chunks in Chroma (bge-m3 via Ollama) plus BM25, in `data/index/chroma` (git-ignored). Five test queries
return in 0.2-0.4 s. Good: the Discipline and Appeal amendment query, the GPSC consultation query (Gujarati) and the Karmayogi LTC query
find the right documents. Weak: both maternity-leave queries miss, probably because no maternity-leave GR is in this corpus (to confirm
with a text search before writing gold questions); the Gujarati one returns noise. Several hits have an empty subject.

## Roadmap Phase 2 (Nov 1, `integration` branch): Squad 2's pipeline behind `/query`
Switch: `GOV_ENGINE=squad2` (default stays `retrieval`). `app/squad2_runtime.py` builds `RAGPipeline` on the first question from our corpus
and the saved index (`data/index/chroma`); `scripts.build_squad2_index` builds the index.

| Task | Result |
|---|---|
| 2.1 Wire `/query` to the pipeline | Done. Real run on `corpus_v1`: verdict `answered`, verbatim citation with lineage, `statements[]` with a label. |
| 2.2 Lineage from our engine | Done. `OurLineageAdapter` answers status and latest version from the contract graph, so Squad 2's own graph (which says Active and links without a reference) is never used. Amending passages are injected using the chunk where our engine found the reference, not the first chunks (letterhead). The prompt never says "Active": it says "No later amendment found in the collection". |
| 2.3 Exact GR number / date first (AI-8) | Done. Numbers are compared by letters and digits only (Gujarati digits converted), so `MLS/1363 /5421-C`, `CON1062/2961-C` and `પીઆરઓ.-૧૦૮૬-૫૦૬૮-ગ-૨` all match. A named GR is pulled in even if hybrid search missed it, with the chunks that best match the question. A written date works the same, only when at most 3 GRs share that day. 6 of 6 number queries and 1 of 1 date query put the right GR first on the real index. |
| 2.4 Prompt-injection guard (AI-19) | Done. Instruction-like sentences are dropped before evidence is numbered (so they cannot steer the model or be cited), and the system prompt says document text is evidence only. 7 attack strings caught; 0 of 21,719 real corpus sentences flagged (a first, looser pattern flagged 3 ordinary "above instructions" sentences and was tightened). |
| 2.5 `statements[]` and `reason_code` | Done in Phase 0, now visible end to end. |
| 2.6 `BROKEN_CHAIN` | Done. A cited GR that amends/supersedes/cancels a GR not in the collection gets a `BROKEN_CHAIN:` warning. If every citation is only an amendment of a missing base, `/query` refuses with `reason_code: BROKEN_CHAIN` (the full rule cannot be stated). Supersedes-only links warn but still answer. Targets that are dates or "rule 9" are ignored. In `corpus_v1`: 30 unresolved changing edges from 20 documents. |
| 2.7 Determinism | Done. Temperature 0, fixed top-k. The same question asked twice gave the same answer, citation and statement. |

End-to-end example (English question, amended Recruitment Rules): "By how much was the upper age limit relaxed for direct selection ... in 2022?"
-> "relaxed by one year", cited to the 2022 notification (rule 16H), statement `established`.

Also changed: the prompt now states the answer language (a 4B model answered an English question in Gujarati); local LLM timeout 180 s and
output cap 700 tokens (`LOCAL_LLM_TIMEOUT`, `LOCAL_LLM_MAX_TOKENS`).

Known problems, not fixed yet:
- **Latency is 35-80 s per answer** on this CPU with `qwen3.5:4b` (first call loads the model); target is under 10 s. A Gemini key
  (`LLM_PROVIDER=auto`) or a smaller/faster local model is the fix; retrieval itself takes 0.3 s.
- **LLM failure looks like "no document".** If the model is unreachable the pipeline returns a canned summary with no citations and
  `/query` refuses with the default `NO_DOCUMENT`. Roadmap 5.4 (extractive fallback quoting the top verified passage) should replace it.
- **Citations carry no `bbox`** from Squad 2's pipeline (it builds citations from sentence text only), so the PDF viewer cannot highlight yet.
  Needs the chunk box looked up by (doc, page, quote) in the bridge.
- A question can be refused when the corpus lacks the text: the 1967 Rules book as converted does not describe how direct recruitment is
  made (2 chunks mention it), and the model correctly said so.

## Roadmap Phase 2 follow-up (Nov 1): latency of the local model
Measured on this laptop (i5-1235U, 12 threads, no GPU) with `qwen3.5:4b` through Ollama. Ollama's own timers show the model **reads the
prompt at about 30 tokens/s and writes at about 5.5 tokens/s**; Gujarati costs about 1.5x the tokens per character of English.

| New question (not cached), model already loaded | Before | After |
|---|---|---|
| English, amended rule | 60-90 s | 34-37 s |
| Gujarati | 125-167 s, often timed out and was refused | 52-55 s |
| Same question asked again (Ollama reuses the processed prompt) | - | 14-25 s |

Beware the last row when benchmarking: repeating a question measures only the writing, and my first "20 s" figures were that. Always
`ollama stop <model>` and use a new question for a real number.

What changed: (1) the model no longer writes the answer twice (`summary` + statements) and uses a compact reply
(`{"statements":[{"t":..,"k":"E","ids":[..]}]}`, about 25 output tokens instead of about 110; the old format is still accepted);
(2) evidence is chosen by overlap with the question and capped (`TOP_K_RERANK=3`, `EVIDENCE_CHARS_PER_CHUNK=500`, `EVIDENCE_MAX_CHARS=1500`,
Gujarati weighted 1.5x), and letterhead fragments are dropped; (3) the system prompt is identical for every question and the language rule moved
to the user message; (4) the app builds the pipeline in the background at startup (`LazySquad2Engine.prewarm`), loads the model and sends the
system prompt once (`warm_up_local_llm`), so the first user does not pay for loading; (5) the reply parser accepts odd shapes (statements as plain
strings, ids at the top level, truncated JSON) instead of crashing, which `qwen3.5:2b` triggered.

Model comparison on 5 questions (same settings, model loaded): `qwen3.5:2b` is about 1.7x faster on Gujarati (33 s vs 57 s) but garbled a date range
in the English answer ("between September 18 and August 31, 2022", the GR says 18 Sep 2022 to 31 Aug 2023) and is not faster everywhere. Kept
`qwen3.5:4b`: a confident wrong date in a legal answer costs more than waiting. Switch with `LOCAL_LLM_MODEL`.
Evidence sweep (cold): 2200/600/3 chunks -> 35 s EN, 66 s GU; 1500/500/3 -> 34 s, 52 s; 1000/400/2 -> 26 s, 43 s; all answered both questions correctly
(two questions only, so recall at the smaller budgets is not established).

**The 10 s target is not reachable on this CPU with a 4B model**: reading about 700-1000 evidence tokens alone takes 25-30 s. Options, in order of effect:
a Gemini key (`GOOGLE_API_KEY`, `LLM_PROVIDER=auto`; seconds, not tested here because there is no key), any machine with a GPU, or a smaller model
with the accuracy cost above.

## Roadmap Phase 3 (Nov 1, `integration` branch): lineage verification, gold questions, scorecard
**Honesty note.** Everything below was checked by Claude reading the extracted document text. Nothing is officer-validated. Files carry
`verified_by` / `validated_by` saying so; a person still has to sign off (see "Needs a human").

### 3.1 The 72 gold lineage pairs (`eval/gold_lineage_review.csv`, `eval/gold_lineage_verified.csv`)
`scripts/gold_lineage_review.py` pulls, for every pair, the sentence in the amending GR that names the base (page + verbatim quote).
- **71 confirmed**: each amending text says "further to amend the <base title>" (or "<Amendment> Rules ... In the <base>, in rule 9 ...").
- **1 rejected (#39)**: file `1_3491` is a Gujarati *circular* (પરિપત્ર) that only lists the 2006 rules and the 2012 notification under "વંચાણે લીધા"
  and issues instructions; it does not amend anything. The portal listed it under the notification's number. The engine was right to skip it.
- **5 of the 71 are the same notification published twice** (Gujarati-script and English copies share one notification number: GS/2010/32,
  GS/2011/10, GS/2013/01, GS/2024/13, GS/2013/25). Both copies do amend the base, but the 72 are not 72 independent amendments: **66 distinct**.
  Flagged in `duplicate_of_row`.
- Engine vs verified gold, pair level: precision 0.958 (69/72), recall 0.972 (69/71). Two of the three "false positives" are real amendments that
  the portal list lacks (2019-05-03 -> 1967 Recruitment Rules; 2020-12-29 -> 2017 Engineering Rules), so precision is understated; one is wrong (below).

### 3.2 A three-step chain: none exists in this corpus
No document both amends and is amended (engine edges), and a text search for an amendment naming another amendment found only documents stating their
own short title. Every amendment amends the base directly (F01: one base + 22 amendments; F04's "Second" and "Third Amendment" each amend the 2017 base).
So the demo can show a *timeline* (base + N amendments in date order), not a 3-hop chain. To demo a chain, a teammate must supply a pair from the portal
where an amendment cites an earlier amendment.

### 3.3 Out-of-sample check (the 72 pairs were tuned on, so they cannot show overfitting)
Eight changing edges lay outside the gold. Read one by one: 2 correct, 5 wrong, 1 doubtful. The wrong ones came from `Resolver.match_title`: it accepts a
candidate when 85% of the candidate's title words occur in order, so "Gujarat Civil Services (Class-I and II) Competitive Examination Rules, **2000**"
matched sentences that actually name the **2017**, **2023** or Subordinate Services rules (longer titles contain the same words). Fix: when the sentence
prints a year after "Rules" and none matches the candidate's title year (one OCR-damaged digit allowed), reject the match
(`_named_year_conflicts`). Result: 8 -> 3 out-of-sample edges (2 correct, 1 wrong), gold score unchanged (P 1.000 / R 0.958 on the old measure).
Still wrong: `Senior Clerk RR Amendment 2020 -> 1967 rules`; the sentence names the 2015 Senior Clerk rules first and quotes the 1967 rules inside the text it
substitutes. Needs a "first-named instrument wins" rule. Sample is tiny (8); treat as an indication, not a rate.

### Corpus v2 (`D:/test/corpus_v2`): 66 of 366 documents were unreadable
Their embedded fonts map Gujarati to Latin gibberish (`Aal, IVLd dietl UMai`), and the manifest tagged them `en`, so the Gujarati OCR pass skipped them.
`build_corpus` now judges by the text (`looks_garbled`: Latin words that are not English), OCRs with `guj+eng` and keeps the better text; language comes from the
script (`script_language`). Garbled documents: 66 -> 0 (the last 2 were family records re-read separately). OCR text now used for 137 documents (was 88).
Index rebuilt (7,501 chunks); `build_squad2_index` now also drops chunks whose text changed (a re-read document keeps its chunk ids).

### Gujarati lineage does not work on real text (the biggest open gap)
Across 132 Gujarati documents the engine found **4 weak references and 139 unresolved**. Example it misses: `1_3871` (13 May 2025) relaxes `1_3869`
(9 May 2025, "all leave cancelled"); it cites it by date and number, but in Gujarati wording ("ઉક્ત સૂચનાઓના અનુસંધાને ... રજાઓ મંજૂર કરી શકશે").
Gold question Q-050 expects this and is reported as failing until patterns are validated on Gujarati text (roadmap "Remaining work").
No document in `corpus_v2` has status `superseded`, so the gold set has 0 superseded questions.

### 3.4 Gold questions (`eval/gold_questions.json`, built by `scripts/make_gold_questions.py`)
50 questions: 24 simple, 11 amended, 10 unanswerable, 5 vague, 0 superseded; 22 English, 16 Gujarati, 12 Gujarati-in-Latin-letters.
Each answerable one has gold document(s) + page and key points; the builder fails unless **every key point occurs on the cited page**. Unanswerable ones
are backed by a text search showing the corpus lacks the topic (e.g. 0 of 366 documents mention maternity leave). Many Gujarati/mixed questions ask about
English documents on purpose: that is how users will ask.

### 3.5 Scorecard (`scripts/scorecard.py`)
`--mode retrieval` (about a minute, no model) and `--mode full` (about 40 s per question on the local model). Five official metrics + lineage status shown + latency.
Retrieval result (`eval/scorecard_retrieval.json`), 35 answerable questions:

| Question language | top-1 | top-3 |
|---|---|---|
| English (15) | 13 | 15 |
| Gujarati (11) | 4 | 7 |
| Gujarati in Latin letters (9) | 5 | 5 |
| **All (35)** | **22 (62.9%)** | **27 (77.1%)** |

English retrieval is strong; **Gujarati and Gujlish retrieval is the weak point**, worst when a Gujarati question targets an English document
(Q-002, Q-008, Q-016, Q-023). Not tuned on these 50: tuning on the set that scores us would make the next number meaningless.

### Guards (spec AI-15 / "vague or legal-advice trap")
`is_out_of_scope` caught the legal-advice trap in English only (1 of 3); `is_too_vague` caught 1 of 5. Both widened (English, Gujarati, Gujarati in Latin letters;
vague = only a broad topic such as leave / salary / rules). They agree with all 50 gold items, but were tuned on the 15 refusal questions, so I also checked
false positives on 324 document titles used as questions: 0 out-of-scope, 1 vague ("Endorsement", a single word). Pinned by 34 tests.

### Needs a human
1. Sign off `eval/gold_lineage_verified.csv` (71 rows have page + quote) and especially the rejected row #39.
2. Send the gold questions to the resource person; the plan calls for officer validation. `validated_by` says "not officer-validated" until then.
3. Decide how to demo "chain": timeline of base + amendments, or find a real amendment-of-amendment.

### Phase 3 result: first full scorecard (Nov 1, `eval/scorecard_full.json`, rescored in `eval/scorecard_full_rescored.json`)
50 questions through `/query` with local `qwen3.5:4b` (36 s median, 62 s p95). Numbers are small-sample (35 answerable, 15 refusals) and the gold is not officer-validated.

| Metric | Result |
|---|---|
| 1. Right document first / in the first three | 62.9% (22/35) / 77.1% (27/35) |
| 2. Citations on the gold page / quote verbatim on its page | 65.6% (21/32) / **100%** (32/32) |
| 3. Answers with every key point (20 answered) | 45% as first scored; **55% (11/20)** after the date-format fix below |
| 4. Amendment pairs vs verified gold | precision 0.958, recall 0.972 (see 3.1 for why precision is understated) |
| 5. Refusals: unanswerable and vague questions refused, with the right reason code | **100% (15/15)**, both |
| 5. Answerable questions refused wrongly | **42.9% (15/35)**; 14/35 (40%) after the BROKEN_CHAIN change below |
| Lineage status shown where one was expected | 2 of 3 (Q-050, Gujarati, fails as predicted) |

**What is good:** the guards and refusals (incl. the legal-advice trap in all three languages), and no fabricated quotes: every quote is verbatim on its page.

**What is wrong, by cause** (15 wrongly refused + 7 wrong answers out of 35 answerable questions):
1. *Right document first, answer chunk not in the evidence* (7 refusals, all English/Gujlish): Q-001 retrieved the Grade III post but the sentence "not less than 20 years and more
   than 40 years of age" sits in the next chunk; the 3 chunks sent were that post's first chunk and two chunks of the *Grade II* rules. The model answered honestly that the sentences
   do not give the age. Retrieval is per chunk and evidence is per chunk: the answer is one chunk over.
2. *Gujarati and Gujlish questions miss the document* (6 refusals, 3 more wrong answers): top-1 English 13/15, Gujarati 4/11, Gujlish 5/9. Worst when a Gujarati question targets an English GR.
3. *Plausible wrong answers from a neighbouring document* (Q-016, Q-022, Q-027, Q-044, Q-049; Q-014 partly): e.g. Q-022 gave the April 2007 amendment's dates for the September 2007 question;
   Q-016 gave "25 marks, 120 minutes" for "100 marks, 2 hours". The quotes are verbatim but from the wrong GR. These are the most dangerous errors and a 4B model does not catch them.
4. *Gujarati lineage not recognised* (Q-050): the answer says all leave is cancelled, ignoring the 13 May relaxation. Known gap (see above).

**Changes made because of the scorecard**
- Scorer: a key point matches if the answer has all its words and numbers in any order, so "October 1, 2015" satisfies "1st October, 2015" (4 correct answers had been marked wrong).
  `--rescore` recomputes this from a saved run without the model. Answer correctness 45% -> 55%; the remaining misses are real.
- `BROKEN_CHAIN` refusal is now opt-in (`GOV_BROKEN_CHAIN_REFUSES=1`); by default the answer carries the `BROKEN_CHAIN:` warning. It had refused Q-013 ("from which date is this
  amendment in force?"), which the amendment answers by itself. Verified: Q-013 now answers with all key points.
- A refusal now shows the pipeline's own reason ("The provided sentences do not mention the age range") instead of the generic "No relevant GR found", which was misleading when a document had been found.

**Recommended next, in order of effect** (not started; each needs a decision):
1. *Sentence-level evidence*: pool the sentences of the top documents and their neighbouring chunks and pick by overlap with the question (fixes cause 1; no extra model time).
2. *Cross-lingual retrieval*: search with the question and an English rendering of it (glossary or one short model call), and for Gujarati questions weight the multilingual vector search over BM25 (cause 2).
3. *Wrong-document answers*: refuse or warn when the cited passage does not contain the question's distinctive numbers/names; a stronger model (hosted API) helps most here.
4. *Gujarati lineage patterns* on real text (cause 4). Re-run `scripts.scorecard` after each change; do not tune on the 50 questions without also keeping a held-out set.
