import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X, Database, MessageCircleQuestion, BadgeCheck, ShieldX, Timer } from 'lucide-react';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Gujlish' },
];

const PILL = {
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  off: 'border-hair bg-sand text-mist',
};

function Counter({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="leading-none">
        <p className="text-[9.5px] font-medium uppercase tracking-wider text-mist">{label}</p>
        <p className="mt-0.5 font-mono text-[14px] font-semibold text-legal">{value}</p>
      </div>
    </div>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, session }) {
  return (
    <header className="z-20 border-b border-hair bg-white/80 backdrop-blur-md">
      <div aria-hidden className="h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 via-60% to-teal-500" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_6px_16px_-6px_rgba(79,70,229,0.55)]">
            <Scale className="h-[18px] w-[18px] text-[#F8F7F4]" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-[15px] font-bold tracking-tight text-transparent">GovResolve-AI</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-emerald-500" />
                Truth Layer
              </span>
            </div>
            <p className="text-[11px] text-mist">Gujarati–English assistant for Government Resolutions</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] lg:inline-flex ${online ? PILL.teal : PILL.off}`}>
            <Database className="h-3 w-3" />
            {online ? `${(stats?.total_grs ?? 0).toLocaleString()} GRs indexed` : 'backend offline'}
          </span>
        </div>

        <div className="hidden items-center gap-5 border-x border-hair px-5 xl:flex" aria-label="This session">
          <Counter icon={MessageCircleQuestion} label="Questions" value={session.asked} color="text-indigo-600" />
          <Counter icon={BadgeCheck} label="Verified answers" value={session.verified} color="text-emerald-600" />
          <Counter icon={ShieldX} label="Refusals" value={session.refused} color="text-rose-600" />
          <Counter icon={Timer} label="Last answer" value={session.lastSec != null ? `${session.lastSec}s` : '—'} color="text-amber-600" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Question language" className="relative flex rounded-xl border border-hair bg-sand/70 p-0.5">
            {LANGS.map((l) => {
              const on = language === l.id;
              return (
                <button
                  key={String(l.id)}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onLanguage(l.id)}
                  className={`relative rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'text-teal-800' : 'text-mist hover:text-legal'} ${l.id === 'gu' ? 'gu-text' : ''}`}
                >
                  {on && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-teal-200" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative">{l.label}</span>
                </button>
              );
            })}
          </div>

          <label
            data-tour="timemachine"
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs transition-colors ${asOf ? 'border-amber-300 bg-amber-50' : 'border-hair bg-sand/70'}`}
            title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
          >
            <Clock3 className={`h-3.5 w-3.5 ${asOf ? 'text-amber-700' : 'text-violet-600'}`} />
            <span className="hidden font-medium text-mist sm:inline">Rules as of</span>
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => onAsOf(e.target.value || '')}
              className="w-[7.4rem] bg-transparent font-mono text-[11px] text-legal outline-none"
              aria-label="View rules as of this date"
            />
            {asOf && (
              <button onClick={() => onAsOf('')} aria-label="Clear date" className="text-mist hover:text-legal">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>
    </header>
  );
}
