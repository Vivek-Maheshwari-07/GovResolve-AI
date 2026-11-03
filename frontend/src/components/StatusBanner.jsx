import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, OctagonX, ShieldQuestion, CalendarClock } from 'lucide-react';
import { STATUS, TONES, REASONS } from '../lib/status';

const ICONS = {
  no_change: CheckCircle2,
  amended: AlertTriangle,
  superseded: OctagonX,
  insufficient: ShieldQuestion,
};

/** Slim, always-visible verdict strip. It sits directly above the answer so it can never be missed or pushed below the fold. */
export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const s = STATUS[status] || STATUS.insufficient;
  const t = TONES[s.tone];
  const Icon = ICONS[s.key] || ShieldQuestion;
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? STATUS[asOfStatus] : null;
  const notIssued = asOf && asOfStatus === 'not_issued';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`relative overflow-hidden rounded-2xl border ${t.ring} ${t.pill} py-3 pl-5 pr-4`}
      role="status"
      aria-label={`Status: ${s.label}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.dot}`} />
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-[22px] w-[22px] shrink-0 ${t.text}`} strokeWidth={2.1} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className={`text-[15px] font-bold ${t.text}`}>{s.headline}</h3>
            <span className={`rounded-full border ${t.ring} bg-white/70 px-2 py-0.5 text-[10.5px] font-bold ${t.text}`}>{s.label}</span>
            {reasonCode && (
              <span className="rounded-full border border-hair bg-white px-2 py-0.5 font-mono text-[10.5px] font-medium text-mist" title={REASONS[reasonCode] || ''}>
                {reasonCode}{REASONS[reasonCode] ? ` · ${REASONS[reasonCode]}` : ''}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-mist">{s.note}</p>

          {(notIssued || asOfInfo) && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                <strong>As of {asOf}:</strong>{' '}
                {notIssued ? 'the cited document had not been issued yet.' : `this document would have shown “${asOfInfo.label}”.`}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
