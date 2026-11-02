import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, OctagonX, ShieldQuestion } from 'lucide-react';
import { STATUS, TONES, REASONS } from '../lib/status';

const ICONS = { no_change: CheckCircle2, amended: AlertTriangle, superseded: OctagonX, insufficient: ShieldQuestion };

export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const s = STATUS[status] || STATUS.insufficient;
  const t = TONES[s.tone];
  const Icon = ICONS[s.key];
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? STATUS[asOfStatus] : null;
  const notIssued = asOf && asOfStatus === 'not_issued';
  return (
    <motion.section
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={`relative overflow-hidden rounded-2xl border ${t.ring} ${t.pill} ${t.glow} p-4 pl-5`}
      role="status"
      aria-label={`Status: ${s.label}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.dot}`} />
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ${t.iconRing} ${t.text}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full ${t.pill} px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${t.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}
            </span>
            {reasonCode && (
              <span className="rounded-full border border-hair bg-sand px-2 py-0.5 font-mono text-[10.5px] text-mist" title={REASONS[reasonCode] || ''}>
                {reasonCode}{REASONS[reasonCode] ? ` · ${REASONS[reasonCode]}` : ''}
              </span>
            )}
          </div>
          <p className={`mt-1.5 text-[15px] font-semibold ${t.text}`}>{s.headline}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-mist">{s.note}</p>
          {notIssued && (
            <p className="mt-2 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-2.5 py-1.5 font-mono text-[11px] text-[#92400E]">
              As of {asOf}: the cited document had not been issued yet
            </p>
          )}
          {asOfInfo && (
            <p className="mt-2 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-2.5 py-1.5 font-mono text-[11px] text-[#92400E]">
              As of {asOf}: this document would have shown “{asOfInfo.label}”
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}
