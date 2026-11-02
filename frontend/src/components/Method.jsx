import React from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, Filter, PenLine, ShieldCheck, Ban, GitBranch, Quote, ArrowDownLeft, CircleSlash, Cpu, CheckCircle2 } from 'lucide-react';

const STEPS = [
  {
    icon: Languages,
    title: '1. Understand',
    text: 'Detects ગુજરાતી, English or Gujlish. Gujlish and Gujarati queries are normalized with legal synonyms to match both Gujarati and English GRs.',
    tint: 'from-teal-500 to-emerald-600',
  },
  {
    icon: DatabaseZap,
    title: '2. Retrieve',
    text: 'Hybrid BM25 keyword matching fused with dense bge-m3 neural embeddings across 7,500+ text chunks. GR numbers trigger exact citation routing.',
    tint: 'from-indigo-600 to-blue-600',
  },
  {
    icon: Filter,
    title: '3. Select Evidence',
    text: 'Top candidate passages compete for a budgeted token context window. Non-authoritative OCR noise and internal form instructions are filtered.',
    tint: 'from-amber-500 to-orange-600',
  },
  {
    icon: PenLine,
    title: '4. Formulate Finding',
    text: 'LLM generates concise findings strictly grounded in numbered evidence chunks. Each claim is explicitly labeled Established or Inferred.',
    tint: 'from-violet-600 to-fuchsia-600',
  },
  {
    icon: ShieldCheck,
    title: '5. Verify & Trace',
    text: 'Every quote is checked verbatim on its page. Lineage status is appended via explicit amendment graphs. Missing evidence triggers formal refusal.',
    tint: 'from-emerald-600 to-teal-700',
  },
];

const RESULTS = [
  {
    value: '100%',
    label: 'Held-Out Top-3 Retrieval',
    note: '11/11 unseen held-out questions find correct target GR in Top-3',
    color: 'text-emerald-700',
    bar: 100,
  },
  {
    value: '0.972',
    label: 'Lineage Graph Precision & Recall',
    note: '71 verified amendment/supersession pairs across English & Gujarati rule families',
    color: 'text-violet-700',
    bar: 97,
  },
  {
    value: '100%',
    label: 'Verbatim Quote Accuracy',
    note: 'Zero hallucinated quotes: every passage verified against OCR bounding boxes',
    color: 'text-amber-700',
    bar: 100,
  },
  {
    value: '20 / 20',
    label: 'Refusal Fidelity with Reason Codes',
    note: 'Vague, unanswerable, and legal-advice questions correctly refused with code',
    color: 'text-rose-700',
    bar: 100,
  },
  {
    value: '81.8%',
    label: 'Held-Out Direct Top-1 Answer Accuracy',
    note: '9/11 answerable held-out questions correctly answered on first attempt',
    color: 'text-indigo-700',
    bar: 82,
  },
  {
    value: '< 10 s',
    label: 'Executive Response Latency',
    note: 'Using Groq Llama 3.3 70B acceleration (vs ~45s local CPU)',
    color: 'text-legal',
    bar: null,
  },
];

const RULES = [
  {
    icon: CircleSlash,
    text: 'Never outputs an "active" or "safe" status. "No later change" strictly means none was discovered in the indexed corpus.',
  },
  {
    icon: GitBranch,
    text: 'Only explicit textual references create lineage links. A GR is amended or superseded only if a later order states so.',
  },
  {
    icon: ArrowDownLeft,
    text: 'Edge direction is strictly newer → older: every link points from the modifying order to the prior order it acts upon.',
  },
  {
    icon: Quote,
    text: 'Quotes are verbatim: every cited passage is verified directly against the underlying PDF page text.',
  },
  {
    icon: Ban,
    text: 'No speculative legal advice or policy predictions. Missing evidence yields a deterministic refusal with a standard reason code.',
  },
];

const fadeVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

export default function Method({ stats }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="mx-auto max-w-5xl space-y-6 pb-8"
    >
      {/* Title */}
      <motion.header variants={fadeVariants} className="space-y-1">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet-700">
          ● Method & Architecture · Deterministic Truth Pipeline
        </p>
        <h2 className="text-[26px] font-extrabold tracking-tight text-legal">
          From Natural Inquiry to Verifiable Proof
        </h2>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-mist">
          A five-stage architecture engineered to prevent hallucinations in government legal reasoning. Every metric below is evaluated and verified on test benchmarks.
        </p>
      </motion.header>

      {/* 5 Architecture Steps */}
      <motion.ol variants={fadeVariants} className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="glass-card relative rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <p className="font-mono text-[10px] font-semibold text-mist uppercase tracking-wider">Step {i + 1}</p>
              <h3 className="text-[14px] font-bold text-legal mt-0.5">{s.title.replace(/^\d+\.\s*/, '')}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-mist">{s.text}</p>
            </div>
          </li>
        ))}
      </motion.ol>

      {/* Measured Benchmark Results */}
      <motion.section variants={fadeVariants} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[17px] font-bold text-legal">Evaluated Scorecard Benchmarks</h3>
            <p className="text-[11.5px] text-mist">
              Measured on held-out and development test sets (16 held-out + 35 dev queries + 71 gold lineage pairs)
            </p>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> All 413 Backend Tests Passing
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESULTS.map((r) => (
            <div key={r.label} className="glass-card rounded-2xl p-4 shadow-sm">
              <p className={`font-mono text-[26px] font-bold tracking-tight ${r.color}`}>{r.value}</p>
              <h4 className="mt-1 text-[13px] font-bold text-legal">{r.label}</h4>
              <p className="text-[11.5px] text-mist mt-0.5">{r.note}</p>
              {r.bar != null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.bar}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Hard Architectural Invariants & Live Corpus */}
      <motion.section variants={fadeVariants} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="glass-card rounded-2xl p-4 lg:col-span-2 shadow-sm">
          <h3 className="mb-2 text-[15px] font-bold text-legal">Hard Invariants & Safety Guarantees</h3>
          <ul className="space-y-2.5">
            {RULES.map((r) => (
              <li key={r.text} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-legal">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                  <r.icon className="h-3.5 w-3.5" />
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/70 to-white p-4 shadow-lift">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-teal-700" />
            <h3 className="text-[15px] font-bold text-legal">Indexed Knowledge Base</h3>
          </div>
          <dl className="space-y-3">
            {[
              ['Government Resolutions', stats?.total_grs],
              ['Text Passages Indexed', stats?.chunks],
              ['Lineage Relations Discovered', stats?.edges],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-teal-100/90 pb-2 last:border-0">
                <dt className="text-[12.5px] text-mist">{k}</dt>
                <dd className="font-mono text-[18px] font-bold text-teal-900">
                  {v != null ? Number(v).toLocaleString() : '—'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-mist leading-relaxed">
            Corpus contains bilingual General Administration & Finance resolutions processed with Gujarati + English OCR.
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}
