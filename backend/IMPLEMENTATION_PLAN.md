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
