import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import Seal from './Seal';
import { STATUS, TONES } from '../lib/status';
import { statusText, reasonText } from '../lib/i18n';
import { useLanguage, useT } from '../lib/LanguageContext';

const STATUS_ICONS = {
  no_change: CheckCircle2,
  amended: AlertTriangle,
  superseded: XCircle,
  conflict: AlertTriangle,
  insufficient: HelpCircle,
};

/** Stamped Executive Verdict Dossier (Linear / Harvey AI style). */
export default function StatusBanner({ status, reasonCode, asOf, asOfStatus }) {
  const { lang } = useLanguage();
  const t = useT();
  const s = STATUS[status] || STATUS.insufficient;
  const loc = statusText(s.key, lang);
  const tone = TONES[s.tone] || TONES.slate;
  const asOfInfo = asOf && asOfStatus && asOfStatus !== 'not_issued' ? statusText(asOfStatus, lang) : null;
  const notIssued = asOf && asOfStatus === 'not_issued';
  const StatusIcon = STATUS_ICONS[s.key] || ShieldAlert;
  const locReason = reasonCode ? reasonText(reasonCode, lang) : '';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      data-tour="verdict"
      className="sheet overflow-hidden border border-[#E6E4DD]"
      role="status"
      aria-label={`Status: ${loc.label}`}
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

      {/* Decorative official classification stamp watermark on the right */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none opacity-[0.05] font-mono text-[64px] font-black uppercase tracking-widest text-[#1E293B]"
      >
        {s.key}
      </div>

      <div className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
        <Seal status={s.key} size={58} stamped className="-ml-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="mono-label text-[9px] font-bold text-[#64748B]">
              {t('status.dossier_verdict')}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border ${tone.ring} ${tone.pill} px-2.5 py-0.5 text-[11px] font-bold ${tone.text} shadow-sm`}>
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{loc.label}</span>
            </span>
            {reasonCode && (
              <span className="rounded-full border border-[#E6E4DD] bg-[#F1EFEA] px-2 py-0.5 font-mono text-[10px] font-medium text-[#64748B]" title={locReason}>
                {reasonCode}{locReason ? ` · ${locReason}` : ''}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <h3 className="display text-[17px] font-bold leading-snug text-[#1E293B]">{loc.headline}</h3>
            <span className="hidden text-xs text-[#64748B] sm:inline">·</span>
            <p className="truncate text-[12px] text-[#64748B]">{loc.note}</p>
          </div>
        </div>
      </div>

      {(notIssued || asOfInfo) && (
        <div className="relative flex items-center gap-2 border-t border-[#FDE68A] bg-[#FFFBEB] px-5 py-2 text-xs font-medium text-[#92400E]">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
          <span>
            <strong>{t('status.as_of_prefix', { date: asOf })}</strong>{' '}
            {notIssued ? t('status.as_of_not_issued') : t('status.as_of_would_show', { label: asOfInfo.label })}
          </span>
        </div>
      )}
    </motion.section>
  );
}
