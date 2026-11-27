# Local merge of the four GitHub branches (27 Nov 2026)

All merging happened locally on `main`. Nothing was pushed and nothing was changed on GitHub
(`main` is 7 commits ahead of `origin/main`).

## Backup

`D:\GovResolve-AI-backups\GovResolve-AI_GitHub_backup_2026-11-27.zip` holds an untouched `git archive` of each
GitHub branch (folders `main/`, `aayush/`, `kunj/`, `feat_bilingual-gujarati-ux/`, plus `README.txt` with the SHAs),
checked with `zipfile.testzip`. The safety branch `backup/pre-merge-2026-11-27` points at the state before the merges.

## The four branches

| Branch | Tip | What it adds |
|---|---|---|
| `main` | `4710234` | The base: FastAPI service, RAG pipeline, lineage engine, React app |
| `aayush` | `07ee2eb` | Live pipeline (`POST /query/stream`), persistent answer cache, metadata enrichment of `data/processed` (portal subjects, `source_url`, `metadata_sources`), bge-m3 index, evidence ranking, finale hardening |
| `kunj` | `9232917` | Interface translations (English / ગુજરાતી / Gujlish, `lib/i18n.jsx` + `translations.js`), `LOCAL_FAST_MODE`, dictation, read-aloud, saved history, current-question filter, batched vector query |
| `feat/bilingual-gujarati-ux` | `12f0603` | Chat & helpline drawer, voice router (`/voice/*`), `/translate`, NVIDIA NIM provider, in-place answer translation, quote/paragraph meanings, re-chunked `data/processed` with `subject_en`/`subject_gu`, shared `query_eval.py` |

Merge commits: `92847e7` (aayush), `8475f70` (kunj), `63b05d1` (feat/bilingual-gujarati-ux).
Preserved earlier local work: `5d7b58e` (stage mode, What changed card, landing motion, print note, single language
selector, 12.5px text floor, `verify_demo_queries.py`).

## Conflicts and how they were resolved

### aayush
- `PipelineLoader.jsx`: live stages from the server; the 12.5px text floor kept.
- `QueryDock.jsx`, `PdfInspector.jsx`, `App.jsx`: streaming callback with sub-second timing; legacy-font notice kept.
- `lib.test.mjs`: both test groups kept. `run.py`: comment only.

### kunj
- `search_engine.py`: parallel question translation and stage events kept, plus the English-term enrichment,
  current-question filter, fast-mode token/evidence budgets and the unsupported-claims warning. The new refusal path
  returned a bare response where the caller expects `(response, from_model)`: fixed.
- Components: Kunj's `t()` translations on top of the live pipeline, stage mode and What changed card; one TopBar
  language selector with a manual re-run; Kunj's dictation replaces the older voice button.
- Added the translation keys the merged components use (all 233 exist in en/gu/gujlish).

### feat/bilingual-gujarati-ux
- **Answer building**: feat moved it into `app/query_eval.py`; the improved version in `main.py` was moved there, so
  `/query`, `/query/stream` and `/voice/query` share one code path. A Gujlish question answered in Latin letters
  reports `gujlish`, not `en`.
- **`search_engine.py` (19 hunks)**: all features of both sides kept (see the merge commit). Two real disagreements:
  - Gujlish answers: feat answered Gujlish in Gujarati script, kunj in Gujlish. Kept Gujlish (the interface has a
    Gujlish mode); asking "in Gujarati" or choosing ગુજરાતી still gives Gujarati script.
  - "Read / વંચાણે લીધા" lines: kunj drops them as noise, feat needs them for "when did the scheme start" questions.
    They are dropped by default and allowed back for origin/start-date questions.
- **Translation cache**: one file (`translations.json`, Gujarati under `__gu__`); a `translations_gu.json` from feat's
  build is still read.
- **Language detection**: the Gujlish glossary first, feat's cue words as a fallback (label `gujlish`).
- **`data/processed` (123 records)**: field-level merge. Text, chunks, departments and `subject_en`/`subject_gu` from
  feat (our chunk text was unchanged from the base); `source_url`, `metadata_sources` and the sourced
  `gr_number`/`issue_date`/`subject` values from aayush.
- **`data/index/chroma`**: kept the bge-m3 index. Feat's index was 2,048-dimension NVIDIA embeddings, which would turn
  vector search off with this project's `EMBEDDING_MODEL=ollama:bge-m3`.
- **Two translation systems**: feat's `lib/i18n.js` would have shadowed kunj's `lib/i18n.jsx` in Vite (the `.js`
  extension is resolved first), silently breaking every translated component. It is renamed to
  `lib/bilingualStrings.js`, and `lib/LanguageContext.jsx` is now an adapter over the single interface-language state.
- **Components**: the HEAD versions were kept whole and feat's features ported in: chat helpline (button in the
  question box), in-place translation of the open answer when the interface language changes (quotes, citations and
  lineage untouched), quote and paragraph meanings, text view when the PDF is not stored, bilingual subjects in the
  library and lineage. `LanguageSwitch.jsx` was removed: the TopBar selector is the single language control.
- **Index builder**: loads both record formats; resets on an embedder change; an index holding 1,000-character prefixes
  is not treated as stale (avoids re-embedding every long chunk).

## Testing

RESULTS_PLACEHOLDER

## Remaining issues

REMAINING_PLACEHOLDER
