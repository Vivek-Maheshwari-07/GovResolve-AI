import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useUiLanguage } from '../lib/i18n';

// The server does not report progress, so these stages are an estimate of the usual order, not a live status.
const STAGES = [
  { key: 'readingQuestion', after: 0 },
  { key: 'searchingCollection', after: 2 },
  { key: 'tracingLineage', after: 6 },
  { key: 'checkingQuotes', after: 12 },
];

export default function PipelineLoader({ onCancel }) {
  const { t } = useUiLanguage();
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const current = STAGES.reduce((acc, s, i) => (sec >= s.after ? i : acc), 0);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="sheet overflow-hidden" role="status" aria-live="polite">
      {/* indeterminate carriage: no fake percentage */}
      <div className="relative h-[3px] overflow-hidden bg-iris-100" aria-hidden>
        <div className="absolute inset-y-0 w-1/4 animate-slide rounded-full bg-gradient-to-r from-transparent via-iris-600 to-transparent" />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label flex items-center gap-2 text-iris-700">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pingSoft rounded-full bg-iris-500" /><span className="relative h-2 w-2 rounded-full bg-iris-600" /></span>
              {t('working')}
            </p>
            <h3 className="display mt-1.5 text-[19px] font-bold text-ink">{t('investigating')}</h3>
            <p className="mt-1 text-[12.5px] text-mist">{t('localModelsMayTake')}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[28px] font-bold leading-none tabular-nums text-ink">{mm}<span className="animate-pulse text-iris-500">:</span>{ss}</p>
            <p className="mono-label mt-1.5 text-[9px] text-faint">{t('elapsed')}</p>
          </div>
        </div>

        <ol className="mt-5 space-y-0.5">
          {STAGES.map((s, i) => {
            const past = i < current;
            const now = i === current;
            return (
              <li key={s.label} className={`grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${now ? 'bg-iris-50' : ''}`}>
                <span className="relative mt-1 grid place-items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ring-2 transition-colors ${past ? 'bg-iris-300 ring-iris-100' : now ? 'bg-iris-600 ring-iris-200' : 'bg-stone ring-transparent'}`} />
                  {i < STAGES.length - 1 && <span aria-hidden className="absolute left-1/2 top-3.5 h-5 w-px -translate-x-1/2 bg-stone" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-[13px] leading-snug ${now ? 'font-bold text-iris-800' : past ? 'font-medium text-mist' : 'text-faint'}`}>{t(s.key)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-center justify-between border-t border-hair pt-3">
          <p className="text-[11px] text-faint">{t('stagesUsualOrder')}</p>
          {onCancel && (
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg bg-ivory px-2.5 py-1 text-[12px] font-semibold text-mist transition hover:text-[#8E1F3A]" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.12), inset 0 1px 0 #fff' }}>
              <X className="h-3.5 w-3.5" /> {t('cancel')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
