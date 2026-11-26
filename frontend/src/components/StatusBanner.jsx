import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import Seal from './Seal';
import { STATUS, TONES, REASONS } from '../lib/status';
import { useUiLanguage } from '../lib/i18n';

const STATUS_ICONS = {
  no_change: CheckCircle2,
  amended: AlertTriangle,
  superseded: XCircle,
  conflict: AlertTriangle,
  insufficient: HelpCircle,
};
const REASON_TRANSLATIONS = {
  NO_DOCUMENT: 'reasonNoDocument',
  TOO_VAGUE: 'reasonTooVague',
  OUT_OF_SCOPE: 'reasonOutOfScope',
  MISSING_FACTS: 'reasonMissingFacts',
  BROKEN_CHAIN: 'reasonBrokenChain',
  POOR_SCAN: 'reasonPoorScan',
};

/** Stamped Executive Verdict Dossier (Linear / Harvey AI style). */
export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const { t } = useUiLanguage();
  const s = STATUS[status] || STATUS.insufficient;
  const translatedKey = s.key === 'no_change' ? 'noChange' : s.key;
  const translatedLabel = t(translatedKey);
  const translatedHeadline = t(`${translatedKey}Headline`);
  const translatedNote = t(`${translatedKey}Note`);
  const reasonLabel = REASON_TRANSLATIONS[reasonCode] ? t(REASON_TRANSLATIONS[reasonCode]) : REASONS[reasonCode] || '';
  const tone = TONES[s.tone] || TONES.slate;
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? STATUS[asOfStatus] : null;
  const notIssued = asOf && asOfStatus === 'not_issued';
  const StatusIcon = STATUS_ICONS[s.key] || ShieldAlert;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      data-tour="verdict"
      className="sheet overflow-hidden border border-[#E6E4DD]"
      role="status"
      aria-label={`${t('status')}: ${translatedLabel}`}
    >
      {/* Executive Security Guilloche / Tonal Wash Pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.32]"
        style={{
          background: `radial-gradient(ellipse at 15% 50%, ${tone.wash} 0%, transparent 65%), linear-gradient(135deg, ${tone.wash} 0%, transparent 50%)`,
        }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone.edge }} />


      <div className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
        <Seal status={s.key} size={58} stamped className="-ml-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border ${tone.ring} ${tone.pill} px-2.5 py-0.5 text-[12.5px] font-bold ${tone.text} shadow-sm`}>
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{translatedLabel}</span>
            </span>
            {reasonCode && (
              <span className="rounded-full border border-[#E6E4DD] bg-[#F1EFEA] px-2 py-0.5 font-mono text-[12.5px] font-medium text-[#64748B]" title={reasonLabel}>
                {reasonCode}{reasonLabel ? ` · ${reasonLabel}` : ''}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <h3 className="display text-[17px] font-bold leading-snug text-[#1E293B]">{translatedHeadline}</h3>
            <span className="hidden text-[12.5px] text-[#64748B] sm:inline">·</span>
            <p className="truncate text-[12px] text-[#64748B]">{translatedNote}</p>
          </div>
        </div>
      </div>

      {(notIssued || asOfInfo) && (
        <div className="relative flex items-center gap-2 border-t border-[#FDE68A] bg-[#FFFBEB] px-5 py-2 text-[12.5px] font-medium text-[#92400E]">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
          <span>
            <strong>{t('asOf', { date: asOf })}</strong>{' '}
            {notIssued ? t('notIssued') : t('wouldShow', { status: t(asOfInfo.key === 'no_change' ? 'noChange' : asOfInfo.key) })}
          </span>
        </div>
      )}
    </motion.section>
  );
}
