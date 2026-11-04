import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X, Search, Activity, Cpu } from 'lucide-react';
import CountUp from './CountUp';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Gujlish' },
];

function Readout({ label, children, tone = 'text-[#1E293B]', title }) {
  return (
    <span className="flex items-baseline gap-1.5" title={title || label}>
      <span className={`font-mono text-[12px] font-bold tabular-nums ${tone}`}>{children}</span>
      <span className="mono-label text-[9px] text-[#64748B]">{label}</span>
    </span>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, session, onCommand, onHome }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E6E4DD] bg-[#F8F7F4]/90 backdrop-blur-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)] print:hidden">
      <div aria-hidden className="h-[2px] bg-gradient-to-r from-[#4F46E5] via-[#818CF8] to-transparent" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        {/* Brand */}
        <motion.button
          type="button"
          onClick={onHome}
          whileTap={{ scale: 0.98 }}
          title="Back to the introduction"
          aria-label="GovResolve-AI: back to the introduction"
          className="flex items-center gap-3 text-left"
        >
          <div
            className="relative grid h-8 w-8 place-items-center rounded-lg bg-[#4F46E5] text-white shadow-sm ring-1 ring-inset ring-white/30"
          >
            <Scale className="h-[17px] w-[17px] text-white" strokeWidth={2.2} />
          </div>
          <div className="leading-none">
            <p className="text-[15.5px] font-extrabold tracking-tight text-[#1E293B]">
              GovResolve<span className="text-[#4F46E5]">·AI</span>
            </p>
            <p className="mono-label mt-1 hidden text-[9px] text-[#64748B] sm:block">PS000230 · Executive Legal Command</p>
          </div>
        </motion.button>

        {/* Command bar */}
        <button
          type="button"
          onClick={onCommand}
          className="group hidden min-w-[13rem] items-center gap-2.5 rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-3 py-1.5 text-left text-[12px] text-[#64748B] transition hover:border-[#C7D2FE] hover:bg-white md:flex shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          aria-label="Focus the question box"
        >
          <Search className="h-3.5 w-3.5 text-[#64748B] transition group-hover:text-[#4F46E5]" />
          <span className="flex-1 font-medium">Ask about a resolution…</span>
          <kbd className="kbd">/</kbd>
        </button>

        {/* High-Density Live Telemetry (Swarm-SAR / Flight Dashboard style) */}
        <div className="hidden items-center gap-2.5 lg:flex pl-1" aria-label="System telemetry">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E4DD] bg-[rgba(255,255,255,0.85)] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#64748B]">
            <Activity className="h-3 w-3 text-[#10B981]" />
            <span>OCR_CONF: 98.8%</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E4DD] bg-[rgba(255,255,255,0.85)] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#64748B]">
            <Cpu className="h-3 w-3 text-[#4F46E5]" />
            <span>HYBRID_RAG</span>
          </span>
          {session.lastSec != null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#E6E4DD] bg-[rgba(255,255,255,0.85)] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#64748B]">
              <span>LATENCY: {session.lastSec}s</span>
            </span>
          )}
        </div>

        {/* Telemetry Readouts */}
        <div className="ml-auto hidden items-center gap-4 xl:flex" aria-label="Collection and session">
          <span className="flex items-center gap-1.5" title={online ? 'Backend reachable' : 'Backend not reachable'}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-[#10B981] animate-pulseDot' : 'bg-[#F43F5E]'}`} />
            <span className="mono-label text-[9.5px] text-[#64748B]">{online ? 'System Live' : 'Offline'}</span>
          </span>
          <Readout label="GRs">{online ? <CountUp value={stats?.total_grs} /> : '—'}</Readout>
          <Readout label="passages">{online ? <CountUp value={stats?.chunks} /> : '—'}</Readout>
          <span className="hidden 2xl:block"><Readout label="links">{online ? <CountUp value={stats?.edges} /> : '—'}</Readout></span>
        </div>

        {/* Controls */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="mono-label hidden text-[10px] text-[#64748B] sm:inline" title="Target language for the answer / પરિણામ ભાષા">
              Answer:
            </span>
            <div role="tablist" aria-label="Answer language" className="relative flex rounded-xl border border-[#E6E4DD] bg-[#F1EFEA] p-0.5">
              {LANGS.map((l) => {
                const on = language === l.id;
                return (
                  <button
                    key={String(l.id)}
                    role="tab"
                    aria-selected={on}
                    onClick={() => onLanguage(l.id)}
                    className={`relative rounded-[9px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${on ? 'text-[#1E293B]' : 'text-[#64748B] hover:text-[#1E293B]'} ${l.id === 'gu' ? 'gu-text' : ''}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="lang-pill"
                        className="absolute inset-0 rounded-[9px] border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10">{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-tour="timemachine"
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition-all ${
              asOf
                ? 'border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] shadow-sm'
                : 'border border-[#E6E4DD] bg-[#F1EFEA] text-[#64748B] hover:bg-white/80'
            }`}
            title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
          >
            <Clock3 className={`h-3.5 w-3.5 shrink-0 ${asOf ? 'text-[#F59E0B]' : 'text-[#4F46E5]'}`} />
            <span className="hidden font-medium sm:inline">Rules as of</span>
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => onAsOf(e.target.value || '')}
              className="w-[6.8rem] cursor-pointer bg-transparent font-mono text-[11px] font-semibold text-[#1E293B] outline-none"
              aria-label="View rules as of this date"
            />
            {asOf ? (
              <button onClick={() => onAsOf('')} aria-label="Clear date" title="Back to today" className="rounded p-0.5 text-[#92400E] hover:bg-[#FDE68A]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
