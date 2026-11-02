import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X } from 'lucide-react';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Mixed' },
];

function Pill({ children, tone = 'mist' }) {
  const dot = tone === 'ok' ? 'bg-[#10B981]' : tone === 'off' ? 'bg-[#64748B]' : null;
  return (
    <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full lg:inline-flex border border-hair bg-sand/60 px-2.5 py-1 font-mono text-[11px] text-mist">
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, latestDate }) {
  return (
    <header className="glass z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-x-0 border-t-0 px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-iris-500 to-iris-400 shadow-[0_6px_16px_-6px_rgba(79,70,229,0.45)]">
          <Scale className="h-[18px] w-[18px] text-[#F8F7F4]" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold tracking-tight">GovResolve-AI</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(79,70,229,0.3)] bg-[rgba(79,70,229,0.12)] px-2 py-0.5 text-[10px] font-medium text-iris-700">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-iris-400" />
              Truth Layer
            </span>
          </div>
          <p className="text-[11px] text-mist">Find the right Government Resolution · every claim has a page</p>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Pill tone={online ? 'ok' : 'off'}>{online ? `${(stats?.total_grs ?? 0).toLocaleString()} GRs indexed` : 'backend offline'}</Pill>
        {stats?.chunks != null && <Pill>{stats.chunks.toLocaleString()} passages</Pill>}
        <Pill>Bilingual OCR</Pill>
        {stats?.lineage_ready && <Pill tone="ok">Lineage graph ready · {stats.edges.toLocaleString()} links</Pill>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Question language" className="relative flex rounded-lg border border-hair bg-sand/60 p-0.5">
          {LANGS.map((l) => {
            const on = language === l.id;
            return (
              <button
                key={String(l.id)}
                role="tab"
                aria-selected={on}
                onClick={() => onLanguage(l.id)}
                className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${on ? 'text-legal' : 'text-mist hover:text-legal'} ${l.id === 'gu' ? 'gu-text' : ''}`}
              >
                {on && (
                  <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-md bg-[rgba(79,70,229,0.22)] ring-1 ring-[rgba(79,70,229,0.4)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{l.label}</span>
              </button>
            );
          })}
        </div>

        <label
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors ${asOf ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.08)]' : 'border-hair bg-sand/60'}`}
          title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
        >
          <Clock3 className={`h-3.5 w-3.5 ${asOf ? 'text-[#92400E]' : 'text-mist'}`} />
          <span className="hidden text-mist sm:inline">Rules as of</span>
          <input
            type="date"
            value={asOf || ''}
            max={latestDate || undefined}
            onChange={(e) => onAsOf(e.target.value || '')}
            className="w-[7.4rem] bg-transparent font-mono text-[11px] text-legal outline-none "
            aria-label="View rules as of this date"
          />
          {asOf && (
            <button onClick={() => onAsOf('')} aria-label="Clear date" className="text-mist hover:text-legal">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>
    </header>
  );
}
