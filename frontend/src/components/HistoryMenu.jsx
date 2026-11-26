import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2, X } from 'lucide-react';
import { useUiLanguage } from '../lib/i18n';

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

/** Saved questions. Opening one restores its answer without asking again. */
export default function HistoryMenu({ history, onOpen, onClear }) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const key = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll('button:not([disabled])');
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === panelRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  const panel = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="history-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/40 p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-chats-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] outline-none"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#E6E4DD] px-4 py-3">
              <h2 id="saved-chats-title" className="eyebrow">{t('savedChats')}</h2>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button type="button" onClick={() => { onClear(); setOpen(false); }} className="inline-flex items-center gap-1 text-[12px] font-medium text-faint hover:text-[#8E1F3A]">
                    <Trash2 className="h-3.5 w-3.5" /> {t('clear')}
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-lg p-1 text-faint transition hover:bg-sand hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {history.length ? (
              <ul role="listbox" aria-label={t('earlierQuestions')} className="max-h-[65vh] overflow-y-auto p-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <button type="button" role="option" onClick={() => { onOpen(h); setOpen(false); }} className="group w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-iris-50">
                      <span className="gu-text line-clamp-2 block text-[13px] leading-snug text-ink">{h.question}</span>
                      <span className="mt-1 flex items-center gap-2 text-[10.5px] text-faint">
                        <span className={`rounded-full px-1.5 py-px font-semibold ${h.response.verdict === 'answered' ? 'bg-[#EEF5F1] text-[#2F5D4E]' : 'bg-sand text-mist'}`}>{h.response.verdict === 'answered' ? t('answered') : t('refused')}</span>
                        <span>{ago(h.at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-[12px] text-faint">{t('noSavedChats')}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-lg bg-sand px-2 py-0.5 text-[11px] font-semibold text-mist ring-1 ring-stone transition hover:text-ink"
        title={t('earlierQuestions')}
      >
        <History className="h-3 w-3 text-iris-500" />
        <span>{t('history')}</span>
        <span className="font-mono text-[10px] text-faint">{history.length}</span>
      </button>
      {panel}
    </>
  );
}
