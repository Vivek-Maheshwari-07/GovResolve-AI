import React from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, Filter, PenLine, ShieldCheck, Ban, GitBranch, Quote, ArrowDownLeft, CircleSlash } from 'lucide-react';

const STEPS = [
  { icon: Languages, title: 'Understand', text: 'Detects ગુજરાતી, English or Gujlish. Non-English questions also get a short English rendering, so they can reach English GRs.', tint: 'from-teal-500 to-emerald-500' },
  { icon: DatabaseZap, title: 'Retrieve', text: 'BM25 keywords and bge-m3 vectors over 7,500 passages, fused. A GR number or date in the question pulls that GR in directly.', tint: 'from-indigo-500 to-blue-500' },
  { icon: Filter, title: 'Select evidence', text: 'The best sentences from the top passages compete for a fixed budget. Instruction-like text inside documents is dropped.', tint: 'from-amber-500 to-orange-500' },
  { icon: PenLine, title: 'Answer', text: 'The model may only use the numbered sentences. Each statement is labelled Established or Inferred.', tint: 'from-violet-500 to-fuchsia-500' },
  { icon: ShieldCheck, title: 'Verify and trace', text: 'Every quote is checked verbatim on its page. Lineage status is added from explicit references. Otherwise it refuses.', tint: 'from-emerald-500 to-teal-600' },
];

// Numbers from eval/SCORECARD_SUMMARY.md (local qwen3.5:4b unless stated). Keep them in step with that file.
const RESULTS = [
  { value: '6 / 11', label: 'Unseen questions answered correctly', note: 'held-out set, never tuned on', color: 'text-indigo-700', bar: 55 },
  { value: '20 / 20', label: 'Refusals correct, right reason code', note: 'unanswerable, vague and legal-advice questions', color: 'text-rose-700', bar: 100 },
  { value: '100%', label: 'Quotes verbatim on their page', note: 'dev and held-out sets', color: 'text-amber-700', bar: 100 },
  { value: '0.97', label: 'Amendment links: precision and recall', note: '71 verified pairs (English rule families)', color: 'text-violet-700', bar: 97 },
  { value: '24 / 35', label: 'Development questions answered correctly', note: 'tuned on these, so optimistic', color: 'text-teal-700', bar: 69 },
  { value: '45 s · 10 s', label: 'Median answer time', note: 'local CPU model · hosted model', color: 'text-legal', bar: null },
];

const RULES = [
  { icon: CircleSlash, text: 'Never calls a rule "active". "No later change" means none was found in these documents.' },
  { icon: GitBranch, text: 'Only explicit references create links. An order is amended or superseded only if a later order says so.' },
  { icon: ArrowDownLeft, text: 'Every link points from the newer order to the older one it acts on.' },
  { icon: Quote, text: 'Quotes are verbatim, checked against the page text before they are shown.' },
  { icon: Ban, text: 'No legal advice or predictions; missing evidence gives a refusal with a reason code.' },
];

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };

export default function Method({ stats }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="mx-auto max-w-5xl space-y-6 pb-8">
      <motion.header variants={fade} className="space-y-1">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-violet-700">● Method · how it works and how well</p>
        <h2 className="text-[26px] font-bold tracking-tight text-legal">From a question to a verified answer</h2>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-mist">Five steps, the same for every question. The numbers below are measured on our own question sets, not claimed.</p>
      </motion.header>

      <motion.ol variants={fade} className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="glass relative rounded-2xl p-4">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-[#F8F7F4] shadow-sm ${s.tint}`}><s.icon className="h-5 w-5" /></div>
            <p className="font-mono text-[10px] text-mist">STEP {i + 1}</p>
            <p className="text-[14px] font-bold text-legal">{s.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-mist">{s.text}</p>
          </li>
        ))}
      </motion.ol>

      <motion.section variants={fade} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-[17px] font-bold text-legal">Measured results</h3>
          <p className="text-[11px] text-mist">Questions drafted from the document text; not yet officer-validated.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESULTS.map((r) => (
            <div key={r.label} className="glass rounded-2xl p-4">
              <p className={`font-mono text-[26px] font-semibold tracking-tight ${r.color}`}>{r.value}</p>
              <p className="mt-1 text-[13px] font-semibold text-legal">{r.label}</p>
              <p className="text-[11.5px] text-mist">{r.note}</p>
              {r.bar != null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${r.bar}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={fade} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <h3 className="mb-2 text-[15px] font-bold text-legal">Rules it never breaks</h3>
          <ul className="space-y-2">
            {RULES.map((r) => (
              <li key={r.text} className="flex gap-2.5 text-[13px] leading-relaxed text-legal">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200"><r.icon className="h-3.5 w-3.5" /></span>
                {r.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4 shadow-lift">
          <h3 className="mb-3 text-[15px] font-bold text-legal">The collection, live</h3>
          <dl className="space-y-3">
            {[
              ['GRs indexed', stats?.total_grs],
              ['Passages searched', stats?.chunks],
              ['Lineage links found', stats?.edges],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-teal-100 pb-2 last:border-0">
                <dt className="text-[12.5px] text-mist">{k}</dt>
                <dd className="font-mono text-[18px] font-semibold text-teal-800">{v != null ? Number(v).toLocaleString() : '—'}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-mist">Gujarati and English GRs; scanned pages read with Gujarati + English OCR.</p>
        </div>
      </motion.section>
    </motion.div>
  );
}
