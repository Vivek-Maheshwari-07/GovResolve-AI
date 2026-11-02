import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Clock3, X, Database, MessageCircleQuestion, BadgeCheck, ShieldX, Timer, Calendar } from 'lucide-react';

const LANGS = [
  { id: null, label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'mixed', label: 'Gujlish' },
];

function TelemetryChip({ icon: Icon, label, value, color, tooltip }) {
  return (
    <div className="flex items-center gap-2 group cursor-default" title={tooltip || label}>
      <div className={`grid h-7 w-7 place-items-center rounded-lg bg-sand/80 border border-hair/70 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="leading-none">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-mist">{label}</p>
        <p className="mt-0.5 font-mono text-[13px] font-bold text-legal">{value}</p>
      </div>
    </div>
  );
}

export default function TopBar({ stats, online, language, onLanguage, asOf, onAsOf, session }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hair/90 bg-white/85 backdrop-blur-md">
      {/* Precision Accent hairline */}
      <div aria-hidden className="h-[2.5px] bg-gradient-to-r from-indigo-500 via-violet-500 via-55% to-teal-500 shadow-[0_1px_3px_rgba(79,70,229,0.2)]" />
      
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        {/* Left: Brand Identity & Truth Engine badge */}
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-[0_4px_14px_-3px_rgba(79,70,229,0.5)]">
            <Scale className="h-[18px] w-[18px] text-[#F8F7F4]" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-[15.5px] bg-gradient-to-r from-indigo-900 via-slate-900 to-legal bg-clip-text text-transparent">
                GovResolve-AI
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-emerald-500" />
                Truth Layer
              </span>
            </div>
            <p className="text-[11px] font-medium text-mist">
              Executive Legal & Administrative Command Center · PS000230
            </p>
          </div>
        </div>

        {/* Center: Live Corpus Stats & Session Telemetry */}
        <div className="hidden items-center gap-5 xl:flex" aria-label="Session Telemetry">
          <div className="flex items-center gap-1.5 rounded-full border border-hair bg-sand/60 px-3 py-1 font-mono text-[11px] text-mist">
            <Database className="h-3.5 w-3.5 text-teal-600" />
            <span className="font-semibold text-legal">
              {online ? `${(stats?.total_grs ?? 0).toLocaleString()} GRs` : 'Offline'}
            </span>
            <span className="text-[#8A94A6]">·</span>
            <span>{online ? `${(stats?.chunks ?? 0).toLocaleString()} passages` : 'backend disconnected'}</span>
          </div>

          <div className="h-4 w-px bg-hair" />

          <div className="flex items-center gap-4">
            <TelemetryChip
              icon={MessageCircleQuestion}
              label="Asked"
              value={session.asked}
              color="text-indigo-600"
              tooltip="Questions investigated in this session"
            />
            <TelemetryChip
              icon={BadgeCheck}
              label="Verified"
              value={session.verified}
              color="text-emerald-600"
              tooltip="Answers backed by verified verbatim quotes"
            />
            <TelemetryChip
              icon={ShieldX}
              label="Refused"
              value={session.refused}
              color="text-rose-600"
              tooltip="Questions refused due to insufficient evidence or legal limits"
            />
            <TelemetryChip
              icon={Timer}
              label="Speed"
              value={session.lastSec != null ? `${session.lastSec}s` : '—'}
              color="text-amber-600"
              tooltip="Time taken for the last answer"
            />
          </div>
        </div>

        {/* Right: Language Selector & Rule Time Machine */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Switcher */}
          <div role="tablist" aria-label="Question language" className="relative flex rounded-xl border border-hair bg-sand/80 p-0.5 shadow-sm">
            {LANGS.map((l) => {
              const on = language === l.id;
              return (
                <button
                  key={String(l.id)}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onLanguage(l.id)}
                  className={`relative rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    on ? 'text-legal' : 'text-mist hover:text-legal'
                  } ${l.id === 'gu' ? 'gu-text' : ''}`}
                >
                  {on && (
                    <motion.span
                      layoutId="lang-pill"
                      className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-stone"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{l.label}</span>
                </button>
              );
            })}
          </div>

          {/* Rule Time Machine Pill */}
          <div
            data-tour="timemachine"
            className={`group relative flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs shadow-sm transition-all ${
              asOf
                ? 'border-amber-300 bg-amber-50/90 text-amber-900 ring-1 ring-amber-200'
                : 'border-hair bg-sand/80 text-mist hover:border-iris-300 hover:bg-white'
            }`}
            title="Rule Time Machine: see which amendments existed on a given day (uses the documents' issue dates)"
          >
            <Clock3 className={`h-3.5 w-3.5 shrink-0 ${asOf ? 'text-amber-700' : 'text-violet-600'}`} />
            <span className="hidden font-medium text-mist sm:inline">Rules as of</span>
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => onAsOf(e.target.value || '')}
              className="w-[7.2rem] bg-transparent font-mono text-[11px] font-medium text-legal outline-none cursor-pointer"
              aria-label="View rules as of this date"
            />
            {asOf ? (
              <button
                onClick={() => onAsOf('')}
                aria-label="Clear date"
                title="Clear date filter"
                className="rounded p-0.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
