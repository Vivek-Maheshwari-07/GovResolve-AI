import React from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowRight } from 'lucide-react';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';

const FEATURES = [
  { icon: Languages, title: 'Ask your way', text: 'ગુજરાતી, English or Gujlish. The question is matched against Gujarati and English GRs alike.', tint: 'from-teal-100 to-teal-50 text-teal-700 ring-teal-200' },
  { icon: Quote, title: 'Proof on the page', text: 'Every statement points to the GR, the page and the exact passage, highlighted on the original PDF.', tint: 'from-amber-100 to-amber-50 text-amber-700 ring-amber-200' },
  { icon: GitBranch, title: 'Amendments traced', text: 'Later orders that amend, replace or cancel a GR are shown, with the sentence that says so.', tint: 'from-violet-100 to-violet-50 text-violet-700 ring-violet-200' },
  { icon: ShieldQuestion, title: 'Says "I cannot tell"', text: 'When the documents do not establish an answer, it refuses and gives the reason.', tint: 'from-rose-100 to-rose-50 text-rose-700 ring-rose-200' },
];

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } } };

export default function Hero({ onAsk, disabled }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-5 pb-4">
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-6">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-violet-200/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
        <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-indigo-600">PS000230 · Find the right Government Resolution</p>
        <h2 className="relative mt-2 text-[26px] font-bold leading-tight tracking-tight text-legal sm:text-[30px]">
          Is this rule <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-600 bg-clip-text text-transparent">still the one to follow?</span>
        </h2>
        <p className="relative mt-2 max-w-xl text-[14px] leading-relaxed text-mist">
          Ask about any GR in everyday words. You get the answer, the page, the exact passage, and every later order in the collection that changes it.
        </p>
        <p className="gu-text relative mt-1 text-[13px] text-teal-700">કોઈપણ ઠરાવ વિશે સરળ ભાષામાં પૂછો: જવાબ, પાનું, મૂળ લખાણ અને પછીના સુધારા સાથે.</p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass flex gap-3 rounded-2xl p-3.5">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ${f.tint}`}>
              <f.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-legal">{f.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-mist">{f.text}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={item} className="space-y-2">
        <p className="px-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist">Try a real question</p>
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
                className={`group flex items-start gap-3 rounded-2xl border bg-gradient-to-br p-3 text-left transition-colors disabled:opacity-50 ${st.card}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.chip} ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.badge}</span>
                  <span className={`mt-1 block text-[13px] font-medium text-legal ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.label}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={item} className="glass rounded-2xl p-3.5">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist">What the status on every answer means</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(STATUS).map((s) => {
            const t = TONES[s.tone];
            return (
              <span key={s.key} className={`inline-flex items-center gap-1.5 rounded-full border ${t.ring} ${t.pill} px-2.5 py-1 text-[11px] font-medium ${t.text}`} title={s.note}>
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-mist">“No later change” means none was found in these documents. It never claims a rule is in force.</p>
      </motion.div>
    </motion.div>
  );
}
