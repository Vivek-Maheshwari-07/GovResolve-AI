import React from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowUpRight } from 'lucide-react';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';

const FEATURES = [
  { icon: Languages, title: 'Ask in your language', text: 'ગુજરાતી, English or Gujlish, matched across both Gujarati and English resolutions.' },
  { icon: Quote, title: 'Proof, not prose', text: 'Every statement cites the GR number, the page and the exact verbatim paragraph.' },
  { icon: GitBranch, title: 'Amendment lineage', text: 'See which orders amend, supersede or cancel the one you are reading.' },
  { icon: ShieldQuestion, title: 'Refuses to guess', text: 'No sufficient proof in the documents? You get a coded refusal, never an invention.' },
];

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

/** Headline block shown above the search box on the landing view. */
export function HeroHeader() {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="text-center">
      <motion.span variants={item} className="inline-flex items-center gap-2 rounded-full border border-hair bg-white px-3 py-1 text-[12px] font-semibold text-mist shadow-card">
        <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
        Government Resolution Intelligence
      </motion.span>

      <motion.h1 variants={item} className="display mx-auto mt-5 max-w-[18ch] text-[32px] font-bold leading-[1.18] text-legal [text-wrap:balance] sm:max-w-[20ch] sm:text-[44px]">
        Is this rule <span className="relative whitespace-nowrap text-iris-600">
          still
          <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2 w-full text-saffron-400">
            <path d="M1 5.5C20 1.5 45 1.5 99 4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </span>{' '}
        the order to follow?
      </motion.h1>

      <motion.p variants={item} className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-mist">
        Ask about any Gujarat Government Resolution. Get a direct answer with the verbatim clause, its page, and every later amendment.
      </motion.p>
      <motion.p variants={item} className="gu-text mx-auto mt-1.5 max-w-xl text-[14px] font-medium text-iris-700">
        કોઈપણ ઠરાવ વિશે પૂછો: અધિકૃત જવાબ, પાનું, મૂળ લખાણ અને પછીના સુધારા સાથે.
      </motion.p>
    </motion.div>
  );
}

/** Samples, guarantees and the status legend, shown below the search box. */
export default function Hero({ onAsk, disabled }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }} className="space-y-9 pb-8">
      <motion.section variants={item} aria-label="Try an example">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 className="eyebrow">Try an example</h2>
          <span className="text-[11.5px] font-semibold text-iris-600">One click, real corpus</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SAMPLES.map((s) => {
            const st = KIND_STYLE[s.kind];
            return (
              <motion.button
                key={s.label}
                type="button"
                disabled={disabled}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onAsk(s.text)}
                className={`group flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-3.5 text-left shadow-card transition-shadow hover:shadow-lift disabled:opacity-50 ${st.card}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                <div className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-semibold text-legal ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.label}</span>
                  <span className={`mt-0.5 block text-[11.5px] font-medium text-mist ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.badge}</span>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-stone transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-iris-600" />
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      <motion.section variants={item} aria-label="How it works" className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-hair pt-8 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-iris-100 bg-iris-50 text-iris-600">
              <f.icon className="h-[17px] w-[17px]" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-legal">{f.title}</h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-mist">{f.text}</p>
            </div>
          </div>
        ))}
      </motion.section>

      <motion.section variants={item} aria-label="Status meanings" className="rounded-2xl border border-hair bg-white/70 p-4">
        <h2 className="eyebrow mb-2.5">Every finding carries one status</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(STATUS).map((s) => {
            const t = TONES[s.tone];
            return (
              <span key={s.key} title={s.note} className={`inline-flex items-center gap-1.5 rounded-full border ${t.ring} ${t.pill} px-2.5 py-1 text-[11.5px] font-semibold ${t.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                {s.label}
              </span>
            );
          })}
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-mist">
          “No later change” means no modifying order was found in the indexed collection. It never claims a rule is in force.
        </p>
      </motion.section>
    </motion.div>
  );
}
