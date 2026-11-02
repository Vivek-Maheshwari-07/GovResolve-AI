import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, GitBranch, ScanSearch, Check } from 'lucide-react';

// The stages are what the pipeline really does, in order. The backend does not stream progress, so the highlight
// moves on a timer that roughly follows a local-model answer (about 40-70 s); the last stage waits for the reply.
const STAGES = [
  { icon: Languages, label: 'Normalizing Gujlish query…', after: 0 },
  { icon: DatabaseZap, label: 'Searching hybrid BM25 + vector index…', after: 4 },
  { icon: GitBranch, label: 'Tracing amendment lineage graph…', after: 14 },
  { icon: ScanSearch, label: 'Verifying exact quote coordinates…', after: 28 },
];

export default function PipelineLoader() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = STAGES.reduce((acc, s, i) => (sec >= s.after ? i : acc), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass space-y-4 rounded-2xl p-4" role="status" aria-live="polite">
      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.label} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${active ? 'bg-[rgba(79,70,229,0.12)] text-legal' : done ? 'text-[#065F46]' : 'text-[#8A94A6]'}`}>
              <Icon className={`h-4 w-4 ${active ? 'animate-pulse text-iris-400' : ''}`} />
              <span>{s.label}</span>
              {active && <span className="ml-auto font-mono text-[11px] text-mist">{sec}s</span>}
            </li>
          );
        })}
      </ol>
      <div className="space-y-2 pt-1" aria-hidden>
        <div className="skeleton h-14 animate-shimmer rounded-xl" />
        <div className="skeleton h-3 w-11/12 animate-shimmer rounded" />
        <div className="skeleton h-3 w-9/12 animate-shimmer rounded" />
        <div className="skeleton h-20 animate-shimmer rounded-xl" />
      </div>
    </motion.div>
  );
}
