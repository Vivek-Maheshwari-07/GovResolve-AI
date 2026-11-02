import React from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowRight, Sparkles, Scale } from 'lucide-react';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';

const FEATURES = [
  {
    icon: Languages,
    title: 'Multi-Script Administrative Search',
    text: 'Ask in ગુજરાતી, English or Gujlish. Cross-matches across both Gujarati and English official GRs.',
    tint: 'from-teal-100 to-teal-50 text-teal-800 ring-teal-200 border-teal-200',
  },
  {
    icon: Quote,
    title: 'Grounded Verbatim Proof',
    text: 'Every statement is cited with exact GR number, page, and illuminated bounding-box paragraph.',
    tint: 'from-amber-100 to-amber-50 text-amber-900 ring-amber-200 border-amber-200',
  },
  {
    icon: GitBranch,
    title: 'Automated Lineage Tracing',
    text: 'Identifies amending, superseding, and cancelling orders with verbatim textual citations.',
    tint: 'from-violet-100 to-violet-50 text-violet-800 ring-violet-200 border-violet-200',
  },
  {
    icon: ShieldQuestion,
    title: 'Strict Hallucination Refusal',
    text: 'When documents lack sufficient proof, the engine formally refuses with a codified reason.',
    tint: 'from-rose-100 to-rose-50 text-rose-800 ring-rose-200 border-rose-200',
  },
];

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

export default function Hero({ onAsk, disabled }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-4 pb-4"
    >
      {/* Executive Command Hero Banner */}
      <motion.div
        variants={itemVariants}
        className="glass-card relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-teal-50/50 p-6 shadow-lift"
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-violet-200/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-indigo-700 shadow-sm">
            <Scale className="h-3 w-3" /> PS000230 · Government Resolution Intelligence
          </span>
          <span className="font-mono text-[10.5px] text-mist hidden sm:inline">Official Decision Support System</span>
        </div>

        <h2 className="relative mt-3 text-[24px] font-extrabold leading-tight tracking-tight text-legal sm:text-[28px]">
          Is this rule{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-600 bg-clip-text text-transparent">
            still the authoritative order to follow?
          </span>
        </h2>

        <p className="relative mt-2 max-w-xl text-[14px] leading-relaxed text-mist">
          Inquire about any Gujarat Government Resolution in natural language. Receive direct answers, verified page coordinates, verbatim clauses, and full amendment lineage.
        </p>
        <p className="gu-text relative mt-1.5 text-[13.5px] font-medium text-teal-800">
          કોઈપણ ઠરાવ વિશે પૂછો: અધિકૃત જવાબ, પાનું, મૂળ લખાણ અને પછીના તમામ સુધારા-વધારા સાથે.
        </p>
      </motion.div>

      {/* 4 Architectural Guarantees */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass-card flex items-start gap-3 rounded-2xl p-3.5 shadow-sm">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 border ${f.tint}`}>
              <f.icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-legal">{f.title}</h3>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist">{f.text}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Curated Interactive Sample Scenarios */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-mist">
            Select an administrative inquiry to test
          </p>
          <span className="font-mono text-[10px] text-indigo-600 font-semibold">1-click demo</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SAMPLES.map((s) => {
            const st = KIND_STYLE[s.kind];
            return (
              <motion.button
                key={s.label}
                type="button"
                disabled={disabled}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAsk(s.text)}
                className={`group flex items-start gap-3 rounded-2xl border bg-gradient-to-br p-3 text-left transition-all shadow-sm hover:shadow-card disabled:opacity-50 ${st.card}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                <div className="min-w-0 flex-1">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${st.chip} ${s.kind === 'gu' ? 'gu-text' : ''}`}>
                    {s.badge}
                  </span>
                  <span className={`mt-1 block text-[13px] font-semibold text-legal ${s.kind === 'gu' ? 'gu-text' : ''}`}>
                    {s.label}
                  </span>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Semantic Status Legend */}
      <motion.div variants={itemVariants} className="glass-card rounded-2xl p-3.5 shadow-sm">
        <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-mist">
          Truth Taxonomy · Status Assigned to Every Finding
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(STATUS).map((s) => {
            const t = TONES[s.tone];
            return (
              <span
                key={s.key}
                className={`inline-flex items-center gap-1.5 rounded-full border ${t.ring} ${t.pill} px-2.5 py-1 text-[11px] font-bold ${t.text}`}
                title={s.note}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                {s.label}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-mist">
          “No later change” denotes that no modifying order was identified in the indexed corpus. It never claims a rule is in force.
        </p>
      </motion.div>
    </motion.div>
  );
}
