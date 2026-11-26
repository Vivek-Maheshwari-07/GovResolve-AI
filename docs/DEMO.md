# Demo script (finale, 27 Nov 2026)

Every question below was asked live on 26 Nov 2026 against the bundled collection (`data/processed`, 156 GRs, bge-m3 index of 1,265
passages) with Groq `openai/gpt-oss-120b`. The times are end to end, from pressing Ask to the verified answer. Nothing here is staged:
if you ask the same question the answer comes from the same pipeline (a repeated question is served from the answer cache in about 0.2 s).

## Setup (10 minutes before)
1. `.env`: `LLM_PROVIDER=groq`, a working `GROQ_API_KEY`, and the hosted evidence budget
   (`TOP_K_RERANK=5`, `EVIDENCE_CHARS_PER_CHUNK=1200`, `EVIDENCE_MAX_CHARS=4500`). Check with `python -m backend.scripts.llm_smoke`
   (Groq must say `OK ping`).
2. `final_dataset/` (the PDFs) in the repo root, so citations open the real page.
3. `python run.py` (or `start.bat`). Ask the first question once before the judges arrive: the first one loads the index (about 7 s).
4. Run `python -m backend.scripts.preflight` (or `make preflight`) with the app running: it checks `.env`, Groq, the index (1,265
   passages), the PDFs and the UI, then asks every question below once so they are instant on stage. It must end with
   `READY FOR THE DEMO`. Delete `data/index/answers.json` to start fresh.
5. Internet is needed for Groq and for the Speak button (browser speech recognition, Chrome or Edge).

## The questions, in order

| # | Shows | Ask exactly | Expected answer | Time |
|---|---|---|---|---|
| 1 | **Explicit amendment found and explained** (the problem statement's core) | What is the upper age limit for direct selection of a Multi Purpose Health Worker (Male), and was it changed by any amendment? | 33 years; the 12 Apr 2022 amendment (KP/22 of 2022) added a proviso exempting contract / ad-hoc workers but did not change the limit. Base rules badge **Amended**; both orders cited with page; lineage tab shows the link. | 1.5 s (7 s if first) |
| 2 | Same in **Gujarati** | મલ્ટી પર્પઝ હેલ્થ વર્કર (પુરુષ)ની સીધી ભરતી માટે ઉપલી વય મર્યાદા કેટલી છે અને તેમાં કોઈ સુધારો થયો છે? | Same facts, written in Gujarati, citing the English notifications | 1.7 s |
| 3 | **The problem statement's own example** (leave) | Which documents or applications are required for leave and LTC, and where must they be submitted? | Leave, LTC, LTC advance and leave encashment applications must be made online in the Karmayogi application (GAD circular of 25 Oct 2024) | 1.8 s |
| 4 | **Gujlish** | Leave ane LTC ni arji kaya application ma karvani farjiyat che? | Online, in the Karmayogi application (circulars of 2 Mar 2024 / 25 Oct 2024) | 1.6 s |
| 5 | **Amendment timeline**, Gujarati question, English documents | ગુજરાત પંચાયત સેવા (વર્ગ-૩) ભરતી (પરીક્ષા) નિયમો, ૨૦૨૧માં કયા સુધારા કરવામાં આવ્યા? | The 15 May 2025 amendment (replaced Annexures A and B) and the 19 Sep 2025 Second Amendment. Open the lineage tab: base rules of 2021 plus two amendments in date order | 1.8 s |
| 6 | Old **scanned/OCR** order | What did the 2001 resolution decide about Home Town LTC and All India LTC under the Central Civil Services (LTC) Rules? | Both suspended for two years (GAD resolution of 10 May 2001) | 1.6 s |
| 7 | **Honest refusal** | How many days of maternity leave are allowed to women government employees? | Refused, `NO_DOCUMENT`: no maternity-leave GR is in the collection | 1.4 s |
| 8 | **Guardrail** | Can I sue the department for wrongly denying my promotion and will I win? | Refused at once, `OUT_OF_SCOPE`, no model call | 0.0 s |

While an answer is being written, point at the **live pipeline panel**: every step (language bridge, hybrid search over 1,265 passages,
lineage check, evidence chosen, model, quote verification) is reported by the server as it happens, with its time.

## Say this out loud (honest limits)
- No document ever gets the status "active". "No later amendment found" means none in these 156 documents, not "in force".
- Statuses come only from explicit references in the text; the model cannot create or deny one. If the model's answer says "no
  amendment" for a document the graph records as amended, that sentence is removed and a warning names the amending order.
- Quotes are verbatim from the stored page text. Some Gujarati PDFs use legacy fonts, so their stored text (and quote) looks garbled;
  the PDF panel shows the real page. OCR (Tesseract) of those files is the fix and is not installed on the demo laptops.
- The collection is a 156-document sample of GAD and Panchayat orders. Missing dates, GR numbers and subjects were repaired from the
  document text, the portal file name and the dataset manifest (`backend/scripts/enrich_metadata.py`, source recorded per field);
  13 dates are still unknown.
- With a hosted model the question and the evidence passages go to Groq. Offline, the app falls back to the local model (slow on a CPU)
  and then to quoting the best passage with a warning.

## Do not ask live
- "What is the standard for passing the Gujarat Panchayat Services (Class-III) Departmental Examination, and has it been amended?"
  (refused in the test run although the documents are present).
- "LTC ni arji kya karvani che ane offline manjur kareli arji gani shakay?" (the second half of the answer could not be confirmed
  against the circular).
- Questions about documents of the full 366-document `corpus_v2` (mobile tariff, Stenographer Grade III, Section Officer rules):
  they are not in the bundled collection.
