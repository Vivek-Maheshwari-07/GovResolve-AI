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
