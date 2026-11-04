import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X, Search } from 'lucide-react';
import CountUp from './CountUp';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Gujlish' },
];

function Readout({ label, children, tone = 'text-legal', title }) {
  return (
    <span className="flex items-baseline gap-1.5" title={title || label}>
      <span className={`font-mono text-[12.5px] font-bold tabular-nums ${tone}`}>{children}</span>
      <span className="mono-label text-faint">{label}</span>
    </span>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, session, onCommand, onHome }) {
    return (
    <header className="sticky top-0 z-30 border-b border-hair bg-canvas/80 backdrop-blur-xl">
      <div aria-hidden className="h-[2px] bg-gradient-to-r from-iris-600 via-iris-400 to-transparent" />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <button type="button" onClick={onHome} title="Back to the introduction" aria-label="GovResolve-AI: back to the introduction" className="flex items-center gap-3 text-left">
          <div
            className="relative grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-b from-[#5F58F2] to-[#4338CA]"
            style={{ boxShadow: '0 0 0 1px rgba(55,48,163,.9), inset 0 1px 0 rgba(255,255,255,.28), 0 8px 16px -8px rgba(79,70,229,.8)' }}
          >
            <Scale className="h-[18px] w-[18px] text-white" strokeWidth={2.1} />
          </div>
          <div className="leading-none">
            <p className="text-[16.5px] font-extrabold tracking-tight text-ink">
              GovResolve<span className="text-iris-600">·AI</span>
            </p>
            <p className="mono-label mt-1 hidden text-[9.5px] text-faint sm:block">PS000230 · Gujarat Government Resolutions</p>
          </div>
        </button>

        {/* Command bar */}
        <button
          type="button"
          onClick={onCommand}
          className="group hidden min-w-[13rem] items-center gap-2.5 rounded-xl bg-white/70 px-3 py-1.5 text-left text-[12.5px] text-faint transition hover:bg-white md:flex"
          style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.09), inset 0 1px 0 rgba(255,255,255,.9)' }}
          aria-label="Focus the question box"
        >
          <Search className="h-3.5 w-3.5 text-mist transition group-hover:text-iris-600" />
          <span className="flex-1">Ask about a resolution…</span>
          <kbd className="kbd">/</kbd>
        </button>

        {/* Telemetry */}
        <div className="ml-auto hidden items-center gap-4 xl:flex" aria-label="Collection and session">
          <span className="flex items-center gap-1.5" title={online ? 'Backend reachable' : 'Backend not reachable'}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-[#4F8A74] animate-pulseDot' : 'bg-[#C2395A]'}`} />
            <span className="mono-label text-mist">{online ? 'Live' : 'Offline'}</span>
          </span>
          <Readout label="GRs">{online ? <CountUp value={stats?.total_grs} /> : '—'}</Readout>
          <Readout label="passages">{online ? <CountUp value={stats?.chunks} /> : '—'}</Readout>
          <span className="hidden 2xl:block"><Readout label="links">{online ? <CountUp value={stats?.edges} /> : '—'}</Readout></span>
        </div>

        {/* Controls */}
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="mono-label hidden text-[10px] text-faint sm:inline" title="Target language for the answer / પરિણામ ભાષા">
              Answer:
            </span>
            <div role="tablist" aria-label="Answer language" className="relative flex rounded-xl bg-sand p-0.5" style={{ boxShadow: 'inset 0 1px 2px rgba(30,41,59,.08), inset 0 0 0 1px rgba(30,41,59,.05)' }}>
              {LANGS.map((l) => {
                const on = language === l.id;
                return (
                  <button
                    key={String(l.id)}
                    role="tab"
                    aria-selected={on}
                    onClick={() => onLanguage(l.id)}
                    className={`relative rounded-[10px] px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'text-ink' : 'text-mist hover:text-ink'} ${l.id === 'gu' ? 'gu-text' : ''}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="lang-pill"
                        className="absolute inset-0 rounded-[10px] bg-ivory"
                        style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.09), 0 1px 3px rgba(30,41,59,.1), inset 0 1px 0 #fff' }}
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
            className={`flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs transition-all ${asOf ? 'bg-[#FFF6E3] text-[#8A4B0B]' : 'bg-sand text-mist hover:bg-ivory'}`}
            style={{ boxShadow: asOf ? '0 0 0 1px #F1D6A0, 0 0 0 4px rgba(217,138,31,.12)' : 'inset 0 1px 2px rgba(30,41,59,.08), inset 0 0 0 1px rgba(30,41,59,.05)' }}
            title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
          >
            <Clock3 className={`h-3.5 w-3.5 shrink-0 ${asOf ? 'text-[#B45309]' : 'text-iris-500'}`} />
            <span className="hidden font-medium sm:inline">Rules as of</span>
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => onAsOf(e.target.value || '')}
              className="w-[6.8rem] cursor-pointer bg-transparent font-mono text-[11.5px] font-semibold text-ink outline-none"
              aria-label="View rules as of this date"
            />
            {asOf ? (
              <button onClick={() => onAsOf('')} aria-label="Clear date" title="Back to today" className="rounded p-0.5 text-[#B45309] hover:bg-[#FBE7C0]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
