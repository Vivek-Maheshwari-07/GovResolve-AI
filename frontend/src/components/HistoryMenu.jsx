import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2 } from 'lucide-react';

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

/** Earlier questions of this browser session. Opening one restores its answer without asking again. */
export default function HistoryMenu({ history, onOpen, onClear }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!history.length) return null;

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" className="inline-flex items-center gap-1 rounded-lg bg-sand px-2 py-0.5 text-[11px] font-semibold text-mist ring-1 ring-stone transition hover:text-ink" title="Earlier questions this session">
        <History className="h-3 w-3 text-iris-500" />
        <span>History</span>
        <span className="font-mono text-[10px] text-faint">{history.length}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }} className="sheet absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[86vw] overflow-hidden p-1.5 shadow-float">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="eyebrow">This session</span>
              <button type="button" onClick={() => { onClear(); setOpen(false); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-faint hover:text-[#8E1F3A]">
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
            <ul role="listbox" aria-label="Earlier questions" className="max-h-72 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id}>
                  <button type="button" role="option" onClick={() => { onOpen(h); setOpen(false); }} className="group w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-iris-50">
                    <span className="gu-text line-clamp-2 block text-[12.5px] leading-snug text-ink">{h.question}</span>
                    <span className="mt-1 flex items-center gap-2 text-[10.5px] text-faint">
                      <span className={`rounded-full px-1.5 py-px font-semibold ${h.response.verdict === 'answered' ? 'bg-[#EEF5F1] text-[#2F5D4E]' : 'bg-sand text-mist'}`}>{h.response.verdict === 'answered' ? 'answered' : 'refused'}</span>
                      <span>{ago(h.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
