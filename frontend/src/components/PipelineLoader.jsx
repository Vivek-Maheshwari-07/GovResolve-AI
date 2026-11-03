import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, GitBranch, ScanSearch, Check, Sparkles, Cpu } from 'lucide-react';

const STAGES = [
  { icon: Languages, label: 'Normalizing multi-script Gujarati/English query…', detail: 'Detecting language, expanding legal synonyms', after: 0, tint: 'bg-iris-50 text-iris-800 ring-iris-200 border-iris-200', icon_c: 'text-iris-600' },
  { icon: DatabaseZap, label: 'Searching hybrid BM25 + dense vector index…', detail: 'Fusing keyword hits & bge-m3 embeddings', after: 2, tint: 'bg-indigo-50 text-indigo-800 ring-indigo-200 border-indigo-200', icon_c: 'text-indigo-600' },
  { icon: GitBranch, label: 'Tracing amendment lineage graph…', detail: 'Extracting modification & supersession edges', after: 6, tint: 'bg-iris-50 text-iris-800 ring-iris-200 border-iris-200', icon_c: 'text-iris-600' },
  { icon: ScanSearch, label: 'Verifying verbatim quote coordinates…', detail: 'Bounding-box validation against document OCR text', after: 12, tint: 'bg-amber-50 text-amber-800 ring-amber-200 border-amber-200', icon_c: 'text-amber-600' },
];

const EXPECTED = 20; // seconds for smooth progress animation

export default function PipelineLoader() {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const current = STAGES.reduce((acc, s, i) => (sec >= s.after ? i : acc), 0);
  const pct = Math.min(95, Math.max(12, (sec / EXPECTED) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="glass-card space-y-4 rounded-2xl p-4 shadow-lift"
      role="status"
      aria-live="polite"
    >
      {/* Header with live timer */}
      <div className="flex items-center justify-between pb-1 border-b border-hair">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Cpu className="h-4 w-4 animate-pulse" />
          </span>
          <div>
            <p className="text-xs font-bold text-legal tracking-tight">Investigating Gujarat Government Resolutions</p>
            <p className="text-[10.5px] text-mist font-mono">Real-time verifiable pipeline running</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-hair bg-sand px-2.5 py-0.5 font-mono text-[11px] font-semibold text-legal">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pingSoft" />
          <span>{sec}s elapsed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-sand">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-iris-500 via-indigo-600 to-amber-500"
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'easeOut', duration: 0.8 }}
          />
        </div>
      </div>

      {/* Pipeline Stages */}
      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li
              key={s.label}
              className={`flex items-start gap-3 rounded-xl p-2 text-[12.5px] transition-all border ${
                active
                  ? `${s.tint} font-semibold ring-1 shadow-sm`
                  : done
                  ? 'border-transparent text-emerald-800 bg-emerald-50/50'
                  : 'border-transparent text-[#8A94A6]'
              }`}
            >
              <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${
                done ? 'bg-emerald-600 text-white' : active ? 'bg-white shadow-sm ring-1 ring-stone' : 'bg-sand'
              }`}>
                <Icon className={`h-3 w-3 ${active ? `animate-spin ${s.icon_c}` : ''}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{s.label}</p>
                {active && <p className="text-[10.5px] font-normal text-mist mt-0.5">{s.detail}</p>}
              </div>
              {done && <span className="font-mono text-[10px] text-emerald-600">done</span>}
              {active && <span className="font-mono text-[10.5px] text-indigo-700 animate-pulse">active</span>}
            </li>
          );
        })}
      </ol>

      {/* Skeleton Preview */}
      <div className="space-y-2 pt-1 border-t border-hair" aria-hidden>
        <div className="skeleton h-12 animate-shimmer rounded-xl" />
        <div className="skeleton h-3 w-10/12 animate-shimmer rounded" />
        <div className="skeleton h-3 w-7/12 animate-shimmer rounded" />
      </div>

      <p className="text-[11px] text-mist flex items-center justify-between">
        <span>Every claim is cross-checked against OCR text before emission.</span>
        <span className="font-mono text-[10px] text-indigo-600">Strict Verbatim Layer</span>
      </p>
    </motion.div>
  );
}
