# Part 1 notes (UI, PDF route, one-command start, security): branch `part1-impl`

Built on top of `part2-answers` (branch `part1-impl`).

## What was there
`frontend/` was a React UI written for Squad 2's old API (`/api/query`, `/api/pdf/...`, an "Ingest PDFs" button). Our backend serves the contract API (`/query`, `/lineage/{id}`, `/documents/{id}`, `/grs/{id}/pdf`).
`run.py` started the old app (`backend.api.main`).

## What changed
- `frontend/src/api.js`: one adapter from the contract to the shapes the components use. Status of an answer = the worst lineage status of its citations (superseded > amended > no later change). Statement citation indexes are resolved to citation objects; the lineage tab is `/lineage/{first cited doc}` in timeline order, edges newer -> older. Tests: `npm test` (6, fake fetch).
- Wording that broke the hard rules is gone: "Safe to Act" and "Operative / Active" became "No later change found" with the line that this does not prove the rule is in force. External stubs show "Not in the collection".
- `warnings` from `/query` are shown under the banner (superseded sources, broken chain, "language model unavailable ...").
- PDF viewer: the PDF.js worker is bundled (no CDN, works offline); the citation `bbox` (PDF points, top-left origin) is drawn as a box on the cited page. The box is the paragraph, not the line.
- The "Ingest PDFs" modal was removed (it called an endpoint that no longer exists; ingestion is `scripts/build_corpus.py`).
- PDF route `GET /grs/{id}/pdf` finds the file by name under `data/raw`, `final_dataset/` and `GOV_PDF_EXTRA_DIRS`, recursively (`app/pdf_lookup.py`). The name comes from the corpus record, reduced to its last path part, so a request cannot choose a path.
- `python run.py` / `start.bat`: picks the real corpus + index when present (else the fixtures, with a notice), builds the UI once, serves UI + API on 127.0.0.1:8000. FastAPI serves `frontend/dist` at `/` after all API routes.
- Security (`app/security.py`): headers (nosniff, X-Frame-Options, no-referrer); optional `GOV_ADMIN_TOKEN` for `/admin/*` and writes to `/documents`; per-client rate limit on `/query` and `/ask` (`GOV_QUERY_RATE_PER_MIN`, default 120); question max 2,000 characters; CORS local only by default (was `*`); listens on 127.0.0.1 unless `--host`.
  Tests in `backend/tests/test_part1_hardening.py`.

## Checked by hand (real corpus, local model, 2 Nov 2026)
`python run.py`: 366 documents; question 1 (mobile tariff) answered with the citation chip, "Established", the real PDF page with the cited paragraph boxed; question 2 (2022 age relaxation) answered and the lineage tab showed the 1967 rules (Amended) with 27 amendments in date order.
The status banner of an answer reflects the *cited* documents: the 2022 amendment itself has no later change, so the banner says "no later change" while the lineage tab shows the base rules amended. Document-level status, as in the contract.

## Not done
No Gujarati keyboard/typing test; no phone layout check; PDF scanned pages whose box is missing (`bbox` null) just show the quote; no login (the demo is local; set `GOV_ADMIN_TOKEN` and keep `--host` default if it must be shared).

## UI redesign (2 Nov 2026): "Warm Alabaster & Legal Ink" command center (light theme)
Built from a design brief. A first version used a dark "Soft Obsidian" palette; it was re-skinned to a low-glare light theme on request (same components and logic; colours are Tailwind tokens in `tailwind.config.js` and `index.css`, status tones in `lib/status.js`). Brief: 3 zones, warm alabaster canvas `#F8F7F4`, ivory glass cards, sand `#F1EFEA` bars, deep slate ink `#1E293B`, indigo accent, pastel emerald/amber/rose status pills, Plus Jakarta Sans + Noto Sans Gujarati + Merriweather + JetBrains Mono, Framer Motion). Fonts and the PDF.js worker are bundled, so it works offline.
- **Zone A** `TopBar`: logo with a "Truth Layer" pulse badge, live telemetry from `/health` (GRs indexed, passages, lineage links), language toggle (Auto / English / ગુજરાતી / Mixed, sent as `language` to `/query`), Rule Time Machine date.
- **Zone B** `QueryDock` (glass input, starter pills, Gujarati keyboard), `PipelineLoader` (4 stages), `StatusBanner`, `AnswerCard` (answer, statements tagged `[Established]` / `[Inferred]` / `[Unverified]`, citation chips, verbatim quotes in a serif face), `LineageGraph` (timeline rail or grid; click a document to open it on the cited page).
- **Zone C** `PdfInspector`: metadata header (GR number, issue date, department, language), cited-passage callout, the PDF page scrolled to the cited page with the `bbox` drawn as an amber glow box, a raw-OCR-text mode (`/grs/{id}/pages/{n}`, the matching paragraph highlighted), page/zoom, copy court-ready citation, report wrong citation, open raw PDF.
- **Rule Time Machine** (`lib/lineage.js`): computed in the browser from the lineage edges and the documents' issue dates. A document is amended / superseded on a date only if the acting order was issued on or before it; later documents are dimmed "Not yet issued". Explicit relations only (a reference never changes a status).

Where the brief was changed on purpose (project rules, or the backend has nothing behind it):
- No "Safe to Act", "Truth Layer Active" or "Active in Corpus", no hard-coded "Lineage Graph F1" (the badge shows live counts from `/health`; the measured pair score is in `data/eval/SCORECARD_SUMMARY.md`): we never output an active status. The green banner reads "No later change found" with the note that this does not prove the rule is in force.
- No "Conflict" status, no scanned-vs-digital badge, no OCR confidence score: the backend does not produce them. Reason-code badges use the real codes (NO_DOCUMENT, TOO_VAGUE, OUT_OF_SCOPE ...), not the brief's names.
- The pipeline stages move on a timer: the backend does not stream progress. They list what the pipeline does, in order.
- "Report wrong citation" copies a ready-to-send report: `/feedback` needs a `query_id` that `/query` does not return.
- No department filter chips (no filter in the API); the chips are a template (GR No. lookup, Leave rules) and real sample questions. No mock data: it runs on the real corpus.
- `run.py` adds `D:/test/dataset_organized` (if present) to the PDF search folders, because the rule-family PDFs are not in the repo's `final_dataset`.
Tests: `npm test` (12: API adapter, time machine, citation text, "no active/safe wording").

## Colour pass (2 Nov 2026)
Each idea of the problem statement has its own colour, used the same way everywhere: indigo = search / AI, teal = bilingual, amber = evidence and citations,
violet = amendment lineage, rose = refusals, emerald / amber / rose = the status of an answer. New landing view (`Hero.jsx`): the question the product answers,
four feature cards, real sample questions colour-coded by kind (English, amended rule, ગુજરાતી, Gujlish, not in the corpus; `lib/samples.js`) and a status legend.
Header: gradient top rule, coloured telemetry pills (shown by width), teal language switch, Rule Time Machine. Loader: one colour per stage and a progress bar.
The root `README.md` now uses the same status wording (never "active") and lists the stack actually used.

## Workspaces, tour and shortcuts (2 Nov 2026)
Patterns borrowed as ideas (not visuals) from a well-made hackathon app: a workspace rail, a spotlight tour, live counters, small-caps eyebrows over big titles, keyboard hints.
- **Rail** (`Rail.jsx`): Ask, Library, Method (+ Tour, Keys); a bottom tab bar on phones.
- **Library** (`Library.jsx`): all GRs from `/grs`, search by GR number / subject / date, filters by language and status (with counts), open a GR to read it and see its lineage.
  `/grs` uses the lineage engine's own words; `mapGrStatus` turns `ACTIVE` into "No later change" so "active" is never shown (test in `api.test.mjs`).
- **Method** (`Method.jsx`): the five pipeline steps, measured results (same numbers as `data/eval/SCORECARD_SUMMARY.md`, with their caveats), the rules it never breaks, live corpus counts.
- **Tour** (`Tour.jsx`): five spotlight steps on `data-tour` targets; shown once (remembered in `localStorage`, safe when storage is blocked); `?` replays it.
- **Session counters** in the header: questions, verified answers, refusals, last answer time (this browser session only).
- **Shortcuts**: `/` ask (switches to Ask and focuses the box), `1 2 3` workspaces, `[ ]` previous/next citation, `?` tour, `Esc` close; listed in the footer and a dialog.
