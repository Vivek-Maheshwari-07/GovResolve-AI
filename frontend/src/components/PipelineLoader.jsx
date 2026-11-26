import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useUiLanguage } from '../lib/i18n';

// Shown only until the first live event arrives (or if the server cannot stream): an estimate of the usual order.
const ESTIMATED = [
  { label: 'Reading the question', detail: 'Detecting language, expanding legal synonyms', after: 0 },
  { label: 'Searching the collection', detail: 'Fusing keyword hits with bge-m3 embeddings', after: 2 },
  { label: 'Tracing amendment lineage', detail: 'Following explicit amend / supersede references', after: 6 },
  { label: 'Checking quotes against the page', detail: 'Every quote must appear verbatim in the source text', after: 12 },
];

// Server stage id -> the step's name in the UI. The detail line comes from the server (real counts, real model).
const TITLES = {
  startup: 'Loading the search index',
  cache: 'Answered before',
  read: 'Reading the question',
  guard: 'Safety guard',
  translate: 'Bridging languages',
  search: 'Hybrid search',
  found: 'Candidate resolutions',
  lineage: 'Tracing amendment lineage',
  evidence: 'Choosing verbatim evidence',
  generate: 'Writing the grounded answer',
  fallback: 'No model answered',
  verify: 'Verifying every quote',
  check: 'Second opinion',
};

function fmt(t) {
  return `${Number(t || 0).toFixed(1)}s`;
}

export default function PipelineLoader({ onCancel, live = [] }) {
  const { t } = useUiLanguage();
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 0.1), 100);
    return () => clearInterval(t);
  }, []);

  const isLive = live.length > 0;
  const whole = Math.floor(sec);
  const mm = String(Math.floor(whole / 60)).padStart(2, '0');
  const ss = String(whole % 60).padStart(2, '0');
  const current = ESTIMATED.reduce((acc, s, i) => (sec >= s.after ? i : acc), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="sheet overflow-hidden" role="status" aria-live="polite">
      <div className="relative h-[3px] overflow-hidden bg-iris-100" aria-hidden>
        <div className="absolute inset-y-0 w-1/4 animate-slide rounded-full bg-gradient-to-r from-transparent via-iris-600 to-transparent" />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label flex items-center gap-2 text-iris-700">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pingSoft rounded-full bg-iris-500" /><span className="relative h-2 w-2 rounded-full bg-iris-600" /></span>
              {isLive ? t('liveFromServer') : t('working')}
            </p>
            <h3 className="display mt-1.5 text-[19px] font-bold text-ink">{t('investigating')}</h3>
            <p className="mt-1 text-[12.5px] text-mist">{t('nothingShownUntilMatched')}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[28px] font-bold leading-none tabular-nums text-ink">{mm}<span className="animate-pulse text-iris-500">:</span>{ss}</p>
            <p className="mono-label mt-1.5 text-[12.5px] text-faint">{t('elapsed')}</p>
          </div>
        </div>

        {isLive ? (
          <ol className="mt-5 space-y-0.5">
            <AnimatePresence initial={false}>
              {live.map((ev, i) => {
                const now = i === live.length - 1;
                return (
                  <motion.li
                    key={`${ev.stage}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg px-2 py-1.5 ${now ? 'bg-iris-50' : ''}`}
                  >
                    <span className="mt-0.5 grid place-items-center">
                      {now
                        ? <span className="mt-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-iris-600 ring-2 ring-iris-200" />
                        : <Check className="h-3.5 w-3.5 text-[#047857]" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[13px] leading-snug ${now ? 'font-bold text-iris-800' : 'font-medium text-mist'}`}>{TITLES[ev.stage] || ev.stage}</p>
                      {ev.detail && <p className="gu-text mt-0.5 text-[12.5px] text-mist">{ev.detail}</p>}
                    </div>
                    <span className="font-mono text-[12.5px] tabular-nums text-faint">{fmt(ev.t)}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        ) : (
          <ol className="mt-5 space-y-0.5">
            {ESTIMATED.map((s, i) => {
              const past = i < current;
              const now = i === current;
              return (
                <li key={s.label} className={`grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${now ? 'bg-iris-50' : ''}`}>
                  <span className="relative mt-1 grid place-items-center">
                    <span className={`h-2.5 w-2.5 rounded-full ring-2 transition-colors ${past ? 'bg-iris-300 ring-iris-100' : now ? 'bg-iris-600 ring-iris-200' : 'bg-stone ring-transparent'}`} />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[13px] leading-snug ${now ? 'font-bold text-iris-800' : past ? 'font-medium text-mist' : 'text-faint'}`}>{s.label}</p>
                    {now && <p className="mt-0.5 text-[12.5px] text-mist">{s.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-hair pt-3">
          <p className="text-[12.5px] text-faint">{isLive ? 'Each step is reported by the server as it happens, with its time.' : 'Waiting for the first step from the server…'}</p>
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
