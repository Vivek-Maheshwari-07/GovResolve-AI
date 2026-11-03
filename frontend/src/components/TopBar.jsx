import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X, Database } from 'lucide-react';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Gujlish' },
];

function Stat({ label, value, tone = 'text-legal', tooltip }) {
  return (
    <div className="flex items-baseline gap-1.5" title={tooltip || label}>
      <span className={`text-[15px] font-bold tabular-nums ${tone}`}>{value}</span>
      <span className="text-[11px] font-medium text-mist">{label}</span>
    </div>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, session }) {
  const used = session.asked > 0;
  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-white/80 backdrop-blur-xl">
      {/* thin saffron + ink rule: the only decoration */}
      <div aria-hidden className="h-[3px] bg-gradient-to-r from-legal via-legal to-saffron-500" style={{ backgroundSize: '100% 100%' }} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-legal shadow-[0_6px_16px_-6px_rgba(15,27,51,0.6)]">
            <Scale className="h-[19px] w-[19px] text-white" strokeWidth={2} />
            <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-saffron-500 ring-2 ring-white" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="display text-[17px] font-bold text-legal">GovResolve<span className="text-iris-600">·AI</span></span>
              <span
                className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold sm:inline-flex ${
                  online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulseDot' : 'bg-rose-500'}`} />
                {online ? 'Live' : 'Offline'}
              </span>
            </div>
            <p className="hidden text-[11.5px] font-medium text-mist sm:block">Gujarat Government Resolutions · PS000230</p>
          </div>
        </div>

        <div className="hidden items-center gap-5 lg:flex" aria-label="Collection and session">
          <div className="flex items-center gap-2 text-[12px] text-mist">
            <Database className="h-3.5 w-3.5 text-iris-500" />
            <span className="font-semibold text-legal tabular-nums">{online ? (stats?.total_grs ?? 0).toLocaleString() : '—'}</span> resolutions
            <span className="text-stone">|</span>
            <span className="font-semibold text-legal tabular-nums">{online ? (stats?.chunks ?? 0).toLocaleString() : '—'}</span> passages
          </div>
          {used && (
            <>
              <span className="h-4 w-px bg-hair" />
              <div className="flex items-center gap-4" aria-label="Session">
                <Stat label="asked" value={session.asked} tooltip="Questions investigated in this session" />
                <Stat label="verified" value={session.verified} tone="text-emerald-700" tooltip="Answers backed by verified verbatim quotes" />
                <Stat label="refused" value={session.refused} tone="text-rose-700" tooltip="Refused: insufficient evidence" />
                <Stat label="last" value={session.lastSec != null ? `${session.lastSec}s` : '—'} tooltip="Time taken for the last answer" />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div role="tablist" aria-label="Question language" className="relative flex rounded-xl border border-hair bg-sand p-0.5">
            {LANGS.map((l) => {
              const on = language === l.id;
              return (
                <button
                  key={String(l.id)}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onLanguage(l.id)}
                  className={`relative rounded-[10px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    on ? 'text-legal' : 'text-mist hover:text-legal'
                  } ${l.id === 'gu' ? 'gu-text' : ''}`}
                >
                  {on && (
                    <motion.span
                      layoutId="lang-pill"
                      className="absolute inset-0 rounded-[10px] bg-white shadow-card ring-1 ring-stone"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{l.label}</span>
                </button>
              );
            })}
          </div>

          <div
            data-tour="timemachine"
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs transition-all ${
              asOf ? 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'border-hair bg-sand text-mist hover:bg-white hover:border-iris-300'
            }`}
            title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
          >
            <Clock3 className={`h-3.5 w-3.5 shrink-0 ${asOf ? 'text-amber-700' : 'text-iris-500'}`} />
            <span className="hidden font-medium sm:inline">Rules as of</span>
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => onAsOf(e.target.value || '')}
              className="w-[6.6rem] cursor-pointer bg-transparent text-[11.5px] font-semibold text-legal outline-none"
              aria-label="View rules as of this date"
            />
            {asOf ? (
              <button onClick={() => onAsOf('')} aria-label="Clear date" title="Clear date filter" className="rounded p-0.5 text-amber-700 hover:bg-amber-100">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
