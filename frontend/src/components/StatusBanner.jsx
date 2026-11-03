import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import Seal from './Seal';
import { STATUS, TONES, REASONS } from '../lib/status';

/** Verdict dossier: an official seal, the headline, and what the verdict does (and does not) mean. */
export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const s = STATUS[status] || STATUS.insufficient;
  const t = TONES[s.tone];
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? STATUS[asOfStatus] : null;
  const notIssued = asOf && asOfStatus === 'not_issued';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="sheet overflow-hidden"
      role="status"
      aria-label={`Status: ${s.label}`}
    >
      {/* tonal wash + ledger rule */}
      <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(100deg, ${t.wash} 0%, ${t.wash}99 38%, transparent 78%)` }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: t.edge }} />

      <div className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
        <Seal status={s.key} size={72} stamped className="-ml-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`mono-label ${t.text}`}>Verdict</span>
            <span className={`rounded-full border ${t.ring} bg-ivory/80 px-2 py-0.5 text-[10.5px] font-bold ${t.text}`}>{s.label}</span>
            {reasonCode && (
              <span className="rounded-full border border-hair bg-ivory/80 px-2 py-0.5 font-mono text-[10.5px] font-medium text-mist" title={REASONS[reasonCode] || ''}>
                {reasonCode}{REASONS[reasonCode] ? ` · ${REASONS[reasonCode]}` : ''}
              </span>
            )}
          </div>
          <h3 className={`display mt-1 text-[19px] font-bold leading-tight ${t.text}`}>{s.headline}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-mist">{s.note}</p>
        </div>
      </div>

      {(notIssued || asOfInfo) && (
        <div className="relative flex items-center gap-2 border-t border-[#F1D6A0] bg-[#FFF6E3] px-5 py-2 text-xs text-[#8A4B0B]">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#B45309]" />
          <span>
            <strong>As of {asOf}:</strong>{' '}
            {notIssued ? 'the cited document had not been issued yet.' : `this document would have shown “${asOfInfo.label}”.`}
          </span>
        </div>
      )}
    </motion.section>
  );
}
