import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, GitBranch, ScanSearch, Check } from 'lucide-react';

// The stages are what the pipeline really does, in order. The backend does not stream progress, so the highlight
// moves on a timer that roughly follows a local-model answer (about 40-70 s); the last stage waits for the reply.
const STAGES = [
  { icon: Languages, label: 'Normalizing Gujlish query…', after: 0, tint: 'bg-teal-50 text-teal-800 ring-teal-200', icon_c: 'text-teal-600' },
  { icon: DatabaseZap, label: 'Searching hybrid BM25 + vector index…', after: 4, tint: 'bg-indigo-50 text-indigo-800 ring-indigo-200', icon_c: 'text-indigo-600' },
  { icon: GitBranch, label: 'Tracing amendment lineage graph…', after: 14, tint: 'bg-violet-50 text-violet-800 ring-violet-200', icon_c: 'text-violet-600' },
  { icon: ScanSearch, label: 'Verifying exact quote coordinates…', after: 28, tint: 'bg-amber-50 text-amber-800 ring-amber-200', icon_c: 'text-amber-600' },
];
const EXPECTED = 50; // seconds, for the progress bar only

export default function PipelineLoader() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = STAGES.reduce((acc, s, i) => (sec >= s.after ? i : acc), 0);
  const pct = Math.min(94, (sec / EXPECTED) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass space-y-4 rounded-2xl p-4" role="status" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-sand">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-teal-500 via-indigo-500 via-60% to-amber-500" animate={{ width: `${pct}%` }} transition={{ ease: 'easeOut', duration: 0.9 }} />
      </div>
      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.label} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all ${active ? `${s.tint} font-semibold ring-1` : done ? 'text-emerald-700' : 'text-[#8A94A6]'}`}>
              <Icon className={`h-4 w-4 ${active ? `animate-pulse ${s.icon_c}` : ''}`} />
              <span>{s.label}</span>
              {active && <span className="ml-auto font-mono text-[11px] opacity-70">{sec}s</span>}
            </li>
          );
        })}
      </ol>
      <div className="space-y-2" aria-hidden>
        <div className="skeleton h-14 animate-shimmer rounded-xl" />
        <div className="skeleton h-3 w-11/12 animate-shimmer rounded" />
        <div className="skeleton h-3 w-9/12 animate-shimmer rounded" />
      </div>
      <p className="text-[11px] text-mist">On this machine the local model takes about 40–70 s per answer.</p>
    </motion.div>
  );
}
