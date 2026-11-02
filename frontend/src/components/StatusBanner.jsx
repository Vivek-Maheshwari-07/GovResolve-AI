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

export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const s = STATUS[status] || STATUS.insufficient;
  const t = TONES[s.tone];
  const Icon = ICONS[s.key] || ShieldQuestion;
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? STATUS[asOfStatus] : null;
  const notIssued = asOf && asOfStatus === 'not_issued';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`relative overflow-hidden rounded-2xl border ${t.ring} ${t.pill} ${t.glow} p-4 shadow-card`}
      role="status"
      aria-label={`Status: ${s.label}`}
    >
      {/* Decorative status strip */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.dot}`} />

      <div className="flex items-start gap-3.5">
        <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ${t.iconRing} ${t.text}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full ${t.pill} border ${t.ring} px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider ${t.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}
            </span>
            {reasonCode && (
              <span className="rounded-full border border-hair bg-sand px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-mist" title={REASONS[reasonCode] || ''}>
                {reasonCode}{REASONS[reasonCode] ? ` · ${REASONS[reasonCode]}` : ''}
              </span>
            )}
          </div>

          <h3 className={`mt-1.5 text-[15.5px] font-bold tracking-tight ${t.text}`}>{s.headline}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-mist">{s.note}</p>

          {/* Time Machine status overlay notifications */}
          {notIssued && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-1.5 text-xs text-amber-900 shadow-sm">
              <CalendarClock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>
                <strong>As of {asOf}:</strong> the cited document had not been issued yet.
              </span>
            </div>
          )}

          {asOfInfo && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-1.5 text-xs text-amber-900 shadow-sm">
              <CalendarClock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>
                <strong>As of {asOf}:</strong> this document would have shown “{asOfInfo.label}”.
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
