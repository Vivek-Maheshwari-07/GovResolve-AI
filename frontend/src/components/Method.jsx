import React from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, Filter, PenLine, ShieldCheck } from 'lucide-react';
import CountUp from './CountUp';

const STEPS = [
  { icon: Languages, title: 'Understand', text: 'Detects ગુજરાતી, English or Gujlish and normalises legal synonyms so a question matches both Gujarati and English GRs.' },
  { icon: DatabaseZap, title: 'Retrieve', text: 'BM25 keyword search fused with bge-m3 embeddings across the indexed passages. A GR number routes straight to that document.' },
  { icon: Filter, title: 'Select evidence', text: 'Candidate passages compete for a fixed token budget. OCR noise and form boilerplate are filtered out.' },
  { icon: PenLine, title: 'Formulate', text: 'The model writes findings grounded in numbered evidence. Each statement is labelled Established or Inferred.' },
  { icon: ShieldCheck, title: 'Verify & trace', text: 'Every quote is checked verbatim on its page, lineage is attached from explicit references, and missing proof becomes a refusal.' },
];

// Figures copied from eval/SCORECARD_SUMMARY.md (2 Nov 2026). Dev set: 50 questions the code was tuned on.
// Held-out: 16 questions written after the code was frozen. Both use the local qwen3.5:4b model.
const ROWS = [
  { metric: 'Correct document first', dev: '82.9%', held: '72.7%' },
  { metric: 'Correct document in first three', dev: '94.3%', held: '72.7%' },
  { metric: 'Answerable questions answered correctly', dev: '24 / 35', held: '6 / 11', strong: true },
  { metric: 'Citation on the gold page', dev: '83.0%', held: '71.4%' },
  { metric: 'Quote verbatim on its page', dev: '100%', held: '100%', strong: true },
  { metric: 'Unanswerable questions refused, right reason code', dev: '15 / 15', held: '5 / 5', strong: true },
  { metric: 'Median / p95 seconds per answer', dev: '45 / 66', held: '48 / 76' },
];

const ARTICLES = [
  ['Never says a rule is in force', '“No later change” only means none was found in the indexed collection. Absence of an amendment is not proof of validity.'],
  ['Explicit references only', 'A GR is amended or superseded only when a later order says so in words. Similarity never creates a link.'],
  ['Newer acts on older', 'Every link points from the modifying order to the prior order it changes.'],
  ['Quotes are verbatim', 'A cited passage must appear exactly in the page text of the source document, or it is dropped.'],
  ['Refuse rather than guess', 'Without sufficient evidence the answer is a refusal with a standard reason code. No legal advice, no predictions.'],
];

const roman = ['I', 'II', 'III', 'IV', 'V'];
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };

export default function Method({ stats }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="mx-auto max-w-5xl space-y-12 pb-12 pt-2">
      <motion.header variants={rise} className="max-w-3xl">
        <p className="mono-label flex items-center gap-2 text-iris-700"><span className="h-px w-6 bg-iris-600" />Method &amp; architecture</p>
        <h2 className="display mt-3 text-[34px] font-bold leading-[1.15] text-ink sm:text-[40px]">From a question to verifiable proof</h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-mist">
          Five stages, built so that a wrong answer is far more likely to be a refusal than an invention. Below: what each stage does, how it scored, and the rules it can never break.
        </p>
      </motion.header>

      {/* pipeline */}
      <motion.section variants={rise} aria-label="Pipeline">
        <ol className="relative grid grid-cols-1 gap-y-6 md:grid-cols-5 md:gap-x-5">
          <span aria-hidden className="absolute left-[19px] top-5 hidden h-px w-[calc(100%-38px)] bg-rule md:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-ink text-white" style={{ boxShadow: '0 0 0 4px #F8F7F4, 0 6px 14px -6px rgba(15,23,42,.6)' }}>
                <s.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <p className="mono-label mt-4 text-[9px] text-faint">Stage {i + 1}</p>
              <h3 className="display mt-0.5 text-[16px] font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist">{s.text}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* scorecard */}
      <motion.section variants={rise} aria-label="Scorecard" className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3">
            <h3 className="display text-[20px] font-bold text-ink">Scorecard</h3>
            <p className="mt-1 text-[12.5px] text-mist">
              Local model qwen3.5:4b. The dev set (50 questions) was used to tune the code, so read the held-out column as the better guide. 16 questions is a small sample.
            </p>
          </div>
          <div className="sheet overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="mono-label border-b border-hair bg-sand/60 text-[9px] text-faint">
                  <th className="px-4 py-2 font-medium">Metric</th>
                  <th className="px-3 py-2 text-right font-medium">Dev · 50 q</th>
                  <th className="px-4 py-2 text-right font-medium">Held-out · 16 q</th>
                </tr>
              </thead>
              <tbody className="ledger">
                {ROWS.map((r) => (
                  <tr key={r.metric} className="border-t border-hair first:border-0">
                    <td className="px-4 py-2.5 text-[13px] text-legal">{r.metric}</td>
                    <td className={`px-3 py-2.5 text-right font-mono text-[13px] tabular-nums ${r.strong ? 'font-bold text-ink' : 'text-mist'}`}>{r.dev}</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-[13px] tabular-nums ${r.strong ? 'font-bold text-ink' : 'text-mist'}`}>{r.held}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
            Lineage: precision 0.972 and recall 0.972 on 71 English amendment pairs (not yet officer-verified; Gujarati lineage is a known gap). Gold questions were drafted by Claude and are not officer-validated. Hosted-model latency of 9–11 s is measured on one partial run.
          </p>
        </div>

        <div className="sheet h-fit p-5">
          <h3 className="eyebrow">Indexed knowledge base</h3>
          <dl className="mt-3 space-y-3.5">
            {[['Government resolutions', stats?.total_grs], ['Text passages indexed', stats?.chunks], ['Lineage links found', stats?.edges]].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-hair pb-3 last:border-0 last:pb-0">
                <dt className="text-[12.5px] text-mist">{k}</dt>
                <dd className="font-mono text-[24px] font-bold tabular-nums text-iris-700"><CountUp value={v} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">Bilingual General Administration and Finance resolutions, read with Gujarati + English OCR.</p>
        </div>
      </motion.section>

      {/* invariants */}
      <motion.section variants={rise} aria-label="Invariants">
        <h3 className="display text-[20px] font-bold text-ink">Five articles the system cannot break</h3>
        <ol className="sheet ledger mt-3 overflow-hidden">
          {ARTICLES.map(([t, body], i) => (
            <li key={t} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-baseline gap-2 px-5 py-4">
              <span className="display text-[17px] font-bold italic text-iris-600">{roman[i]}.</span>
              <div>
                <p className="text-[14px] font-bold text-ink">{t}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-mist">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>
    </motion.div>
  );
}
