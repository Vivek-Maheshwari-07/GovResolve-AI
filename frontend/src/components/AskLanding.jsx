import React from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowUpRight } from 'lucide-react';
import Seal from './Seal';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';

const FEATURES = [
  { icon: Languages, title: 'Ask in your language', text: 'ગુજરાતી, English or Gujlish, matched across Gujarati and English resolutions.' },
  { icon: Quote, title: 'Proof, not prose', text: 'Every statement cites the GR number, the page and the exact verbatim paragraph.' },
  { icon: GitBranch, title: 'Amendment lineage', text: 'See which orders amend, supersede or cancel the one you are reading.' },
  { icon: ShieldQuestion, title: 'Refuses to guess', text: 'Without sufficient proof you get a coded refusal, never an invention.' },
];

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 26 } },
};

/** Masthead: left-aligned editorial headline above the question box. */
export function HeroHeader() {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={rise} className="flex items-center gap-3">
        <span className="h-px w-8 bg-[#4F46E5]" />
        <span className="mono-label text-[#4F46E5]">Government Resolution Intelligence</span>
      </motion.div>

      <motion.h1 variants={rise} className="display mt-5 text-[36px] font-bold leading-[1.13] text-[#1E293B] [text-wrap:balance] sm:text-[50px]">
        Is this rule{' '}
        <span className="relative whitespace-nowrap italic text-[#4F46E5]">
          still
          <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute bottom-[0.02em] left-0 h-[0.14em] w-full text-[#F59E0B]">
            <motion.path d="M1 5.5C20 1.5 45 1.5 99 4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.7, ease: 'easeOut' }} />
          </svg>
        </span>{' '}
        the order to follow?
      </motion.h1>

      <motion.p variants={rise} className="mt-5 max-w-[34rem] text-[16px] leading-relaxed text-[#64748B]">
        Ask about any Gujarat Government Resolution. Get a direct answer with the verbatim clause, its page, and every later amendment.
      </motion.p>
      <motion.p variants={rise} className="gu-text mt-1 max-w-[34rem] text-[14px] font-medium text-[#4F46E5]">
        કોઈપણ ઠરાવ વિશે પૂછો: અધિકૃત જવાબ, પાનું, મૂળ લખાણ અને પછીના સુધારા સાથે.
      </motion.p>
    </motion.div>
  );
}

/** Illustrative dossier (invented GR numbers, labelled as such): shows what an answer looks like before the first question. */
export function Specimen({ className = '' }) {
  const nodes = [
    { x: 48, label: 'GR/EX/2014', tone: '#F59E0B' },
    { x: 160, label: 'GR/EX/2018', tone: '#F59E0B' },
    { x: 272, label: 'GR/EX/2022', tone: '#10B981' },
  ];
  const arc = (a, b) => `M${b.x} 94 C${b.x} 40, ${a.x} 40, ${a.x} 90`;
  return (
    <div className={`relative ${className}`} aria-label="Illustrative example of an answer">
      {/* paper stack */}
      <div aria-hidden className="sheet absolute inset-x-3 top-5 h-full -rotate-[5deg] opacity-80" />
      <div aria-hidden className="sheet absolute inset-x-1.5 top-2.5 h-full rotate-[2.5deg] opacity-95" />

      <motion.div initial={{ opacity: 0, y: 24, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: -0.6 }} transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.35 }} className="sheet relative overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="mono-label rounded border border-[#E6E4DD] bg-[#F1EFEA] px-1.5 py-0.5 text-[#64748B]">Example · illustrative</span>
            <p className="display mt-3 text-[15px] font-bold leading-snug text-[#1E293B]">Recruitment rules: age relaxation</p>
            <p className="mt-1 font-mono text-[10.5px] text-[#64748B]">DOSSIER № EX-0007 · 3 ORDERS IN CHAIN</p>
          </div>
          <Seal status="amended" size={78} stamped delay={1.0} />
        </div>

        <svg viewBox="0 0 320 120" className="mt-3 w-full" role="img" aria-label="Three orders, each amending the one before">
          {[0, 1].map((i) => (
            <g key={i}>
              <motion.path d={arc(nodes[i + 1], nodes[i])} fill="none" stroke={nodes[i + 1].tone} strokeWidth="1.7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1 + i * 0.25, duration: 0.8, ease: 'easeOut' }} />
              <polygon points={`${nodes[i].x - 4},86 ${nodes[i].x + 4},86 ${nodes[i].x},94`} fill={nodes[i + 1].tone} />
            </g>
          ))}
          <line x1="20" x2="300" y1="98" y2="98" stroke="#E6E4DD" strokeDasharray="2 4" />
          {nodes.map((n) => (
            <g key={n.label}>
              <circle cx={n.x} cy="98" r="5" fill="#FAF9F5" stroke={n.tone} strokeWidth="2.2" />
              <text x={n.x} y="114" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fontWeight="600" fill="#1E293B">{n.label}</text>
            </g>
          ))}
          <text x="104" y="52" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8.5" fontWeight="700" fill="#92400E">AMENDS</text>
          <text x="216" y="52" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8.5" fontWeight="700" fill="#92400E">AMENDS</text>
        </svg>

        <blockquote className="legal-text mt-3 border-l-[3px] border-[#D97706] bg-[#FFFBEB] py-2 pl-3 pr-2 text-[12.5px] text-[#1E293B]">
          “…the upper age limit shall stand relaxed by one year…”
          <footer className="mono-label mt-1 text-[9.5px] text-[#92400E]">p.2 · verbatim · illustrative text</footer>
        </blockquote>
      </motion.div>
    </div>
  );
}

/** Case files, capabilities and the five seals, shown below the masthead. */
export default function Hero({ onAsk, disabled }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }} className="space-y-14 pb-10 pt-14">
      <motion.section variants={rise} aria-label="Try an example">
        <div className="mb-3 flex items-end justify-between px-0.5">
          <div>
            <h2 className="eyebrow">Case files</h2>
            <p className="display mt-1 text-[20px] font-bold text-[#1E293B]">Open one to see the answer</p>
          </div>
          <span className="mono-label hidden text-[#64748B] sm:block">One click · real corpus</span>
        </div>
        <ol className="sheet ledger overflow-hidden">
          {SAMPLES.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAsk(s.text)}
                className="group relative grid w-full grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#EEF2FF]/60 disabled:opacity-50"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-[#4F46E5] transition-transform duration-300 group-hover:scale-y-100" />
                <span className="font-mono text-[11px] font-semibold text-[#64748B]">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className={`block truncate text-[14.5px] font-semibold text-[#1E293B] ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#64748B]">
                    <span className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[s.kind].dot}`} />
                    <span className={s.kind === 'gu' ? 'gu-text' : ''}>{s.badge}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#E6E4DD] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#4F46E5]" />
              </button>
            </li>
          ))}
        </ol>
      </motion.section>

      <motion.section variants={rise} aria-label="How it works" className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#E6E4DD] sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div key={f.title} className={`bg-[rgba(255,255,255,0.88)] backdrop-blur-md p-5 ${i > 0 ? 'border-t border-[#E6E4DD] sm:border-t-0 sm:border-l' : ''} ${i === 2 ? 'sm:border-t sm:border-l-0 lg:border-t-0 lg:border-l' : ''}`}>
            <f.icon className="h-[18px] w-[18px] text-[#4F46E5]" strokeWidth={2} />
            <h3 className="mt-3 text-[14px] font-bold text-[#1E293B]">{f.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748B]">{f.text}</p>
          </div>
        ))}
      </motion.section>

      <motion.section variants={rise} aria-label="Status meanings">
        <h2 className="eyebrow">Every finding carries one seal</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {Object.values(STATUS).map((s) => {
            const t = TONES[s.tone];
            return (
              <div key={s.key} title={s.note} className="flex flex-col items-start gap-2.5">
                <Seal status={s.key} size={62} />
                <div>
                  <p className={`text-[12.5px] font-bold leading-tight ${t.text}`}>{s.label}</p>
                  {s.reserved && <p className="mono-label mt-1 text-[9px] text-[#64748B]">Reserved · not emitted yet</p>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 max-w-2xl text-[12.5px] leading-relaxed text-[#64748B]">
          “No later change” means no modifying order was found in the indexed collection. It never claims a rule is in force.
        </p>
      </motion.section>
    </motion.div>
  );
}
