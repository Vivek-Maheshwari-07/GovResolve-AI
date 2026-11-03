# Requirements traceability: PS000230

Source: `docs/PS.txt` (official statement) and `docs/PS230.pdf` (project proposal, Squad 4 deliverables).
Status key: **Met** · **Met, with caveat** · **Partial** · **Open**. “Verified” means checked in code or in a live run (demo mode, 23 fixtures);
the real corpus, search index and language model were not available for that run, so accuracy figures are the team's own (`eval/SCORECARD_SUMMARY.md`).

## A. Minimum prototype requirements

| # | Requirement | Status | Where it lives | Notes |
|---|---|---|---|---|
| 1 | Search scanned and digitally generated documents | Met, with caveat | `backend/ingestion`, `scripts/build_corpus` (text layer, Tesseract `guj+eng`) | Corpus v2 has 366 GRs outside git. Not re-run here. Many Gujarati text layers are lossy; OCR is kept when it scores higher. |
| 2 | Understand Gujarati, English and mixed questions | Met | `rag/gujlish_normalizer`, `llm_gateway.translate_to_english`, language switch, Gujarati keypad | Gujarati and Gujlish questions returned results in the live run. Evidence recall for Gujarati questions is lower than English (reported). |
| 3 | Extract department, subject, GR number, issue date | Met, with caveat | corpus builder; shown in the Library (all four), the inspector header, and **now on every citation in an answer** | **Added:** subject and department under each quote; Library **department filter**. Reported fill rates: subject 88.5%, GR number 97%. Issue-date coverage is not stated in the repository notes. |
| 4 | Retrieve relevant provisions and generate grounded answers | Met | `rag/search_engine.py` (hybrid retrieval, sentence-ID grounding) | Reported: 24/35 (69%) dev, 6/11 (55%) held-out answered correctly. |
| 5 | Display supporting document, exact passage and page number (and date) | Met | `AnswerCard`, `PdfInspector` | Quote, GR number, issue date and page on every citation. The paragraph highlight needs the PDF and a box; without the PDF the UI offers the OCR text. |
| 6 | Identify explicit amendments, replacements, superseded instructions | Met, with caveat | `app/graph.py`, `app/lineage/*`, lineage map | Known defect: negation and proposals create false edges (finding F1 in the design PDF). Gujarati phrases are partly unconfirmed. |
| 7 | Distinguish established facts from assumptions and unsupported conclusions | Met | statement labels (Established / Inferred / Not found); **Trust Shield** summarises them | |
| 8 | State when documents are insufficient to determine the answer or its current applicability | Met | coded refusals; verdict seal; “no later change” never claims a rule is in force | 20 of 20 refusal questions correct (reported). |

## B. Deliverables named in the proposal (Squad 4 and shared)

| Deliverable | Status | Evidence / change |
|---|---|---|
| Chat interface | **Partial → improved** | The question box and answer view existed. **Added:** session history (reopen an earlier question and its answer without asking again). Still open: multi-turn conversation where a follow-up uses the earlier question as context. |
| Visual amendment timeline | Met, improved | Lineage map with arcs, clause evidence and time scrubber. **Added:** the map now follows the **selected citation**, so an answer citing several resolutions shows each one's own chain (previously only the first). |
| Exact-passage PDF highlighter | Met | `PdfInspector` “verbatim lock” from the citation box. Needs the PDF files, which live outside git. |
| Trust Shield | **Gap → implemented** | `TrustShield` under every answer: number of verbatim quotes, resolutions and date span, lineage check result, established / inferred counts. For a refusal it states that nothing was guessed. Computed only from the response. |
| Active vs superseded flag logic | Met | No “active” status anywhere in the UI; `/grs` still returns the internal word (finding F3). |
| Rule lineage “from creation to current state” | Met | Time Machine: header date, scrubber on the map, verdict note. |
| Monitor latency | Met | Session counters in the footer; per-answer time in the header. |
| Data: 100–200 public GRs with amendment chains | Met | 366 GRs; 71 gold lineage pairs. |
| Data: officer-validated questions and answers | **Open** | Gold questions were drafted by Claude and are not officer-validated. Needs people, not code. |

## C. Evaluation criteria in the statement

| Criterion | Where measured | Reported result |
|---|---|---|
| Correct-document retrieval | `eval/` scorecards | 82.9% top-1 (dev), 72.7% (held-out, full pipeline) |
| Citation and page-number accuracy | scorecard | 83.0% / 71.4% on the gold page; 100% verbatim |
| Answer correctness | scorecard | 69% dev, 55% held-out |
| Amendment-chain identification | `eval/gold_lineage_*.csv` | P 0.972, R 0.972 on 71 English pairs (not officer-verified) |
| Unanswerable questions / uncertain applicability | scorecard | 20 of 20 refused with the right reason code |

## D. Worked example from the statement

“Which documents are required for this type of leave?” The notes record that the maternity-leave questions **miss on corpus v1** (probably no such GR in the collection), so on that corpus the assistant should refuse with `NO_DOCUMENT`. Check this on the final corpus before the demo; if the leave GRs are present the answer should cite their pages and any linked amendments.

## E. Introduction and onboarding (added)

| Item | Behaviour |
|---|---|
| Landing page `frontend/src/pages/Hero.jsx` | Shown on a first visit. Explains the problem with an interactive time demo that uses the app's own `statusAsOf`, the four-step method, the limits with the real scorecard numbers, and who asks. |
| Get Started | Opens the application and starts the guided tour. “Skip to the app” opens it without the tour. |
| Guided tour `components/Tour.jsx` | 11 steps on the live app: it types and asks a sample question, waits for the answer, then spotlights the verdict, finding and Trust Shield, passages, inspector, lineage, time machine and Library. The highlighted area stays clickable. The last step opens the application. Press `?` to replay. |
| Returning visitors | Go straight to the app. `?intro=1` forces the introduction; the brand in the header returns to it. |

## F. Still open after this pass

1. Multi-turn context for follow-up questions.
2. Officer validation of questions and lineage pairs.
3. Negation and proposal handling in the lineage engine; Gujarati phrase confirmation.
4. Admin token on by default; `/grs` must not return `ACTIVE`.
5. Confirm the leave example on the final corpus.
