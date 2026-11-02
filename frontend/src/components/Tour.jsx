import React, { useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';

// A short spotlight tour for first-time users (and judges). Each step points at an element marked data-tour="...".
export const TOUR_STEPS = [
  { target: 'rail', title: 'Three workspaces', text: 'Ask questions, browse the whole Library of GRs, or read the Method and its measured results.' },
  { target: 'ask', title: 'Ask your way', text: 'Type in ગુજરાતી, English or Gujlish. Press / from anywhere to jump here.' },
  { target: 'answer', title: 'Every answer carries a status', text: 'No later change, amended, superseded, or a refusal with its reason. It never claims a rule is in force.' },
  { target: 'evidence', title: 'Proof on the page', text: 'The original GR opens on the cited page with the paragraph marked. Copy a court-ready citation in one click.' },
  { target: 'timemachine', title: 'Rule Time Machine', text: 'Pick a date to see which amendments had been issued by then.' },
];

const PAD = 8;

function useRect(target, open) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect(r.width && r.height ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 400); // layout can move while answers animate in
    return () => { window.removeEventListener('resize', measure); clearInterval(t); };
  }, [target, open]);
  return rect;
}

export default function Tour({ open, onClose }) {
  const [i, setI] = useState(0);
  const step = TOUR_STEPS[i];
  const rect = useRect(step.target, open);

  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => Math.min(TOUR_STEPS.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const last = i === TOUR_STEPS.length - 1;
  // card goes beside the spotlight when there is room, else centred
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let pos = { left: vw / 2 - 170, top: vh / 2 - 90 };
  if (rect) {
    if (rect.x + rect.w + 360 < vw) pos = { left: rect.x + rect.w + 14, top: Math.min(Math.max(16, rect.y), vh - 220) };
    else if (rect.x - 360 > 0) pos = { left: rect.x - 354, top: Math.min(Math.max(16, rect.y), vh - 220) };
    else if (rect.y + rect.h + 220 < vh) pos = { left: Math.min(Math.max(16, rect.x), vw - 356), top: rect.y + rect.h + 14 };
    else pos = { left: Math.min(Math.max(16, rect.x), vw - 356), top: Math.max(16, rect.y - 214) };
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Guided tour">
          {rect ? (
            <motion.div
              className="pointer-events-none absolute rounded-2xl ring-2 ring-indigo-400"
              style={{ boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.42)' }}
              animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            />
          ) : (
            <div className="absolute inset-0 bg-[rgba(15,23,42,0.42)]" />
          )}
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="absolute w-[340px] rounded-2xl border border-indigo-100 bg-white p-4 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]"
            style={pos}
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Welcome · {i + 1} / {TOUR_STEPS.length}</p>
              <button onClick={onClose} aria-label="Close tour" className="rounded p-0.5 text-mist hover:text-legal"><X className="h-4 w-4" /></button>
            </div>
            <h3 className="text-[17px] font-bold tracking-tight text-legal">{step.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-mist">{step.text}</p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-indigo-500' : 'w-1.5 bg-stone'}`} />)}
              </div>
              <div className="flex gap-2">
                {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-mist hover:text-legal">Back</button>}
                <button onClick={() => (last ? onClose() : setI(i + 1))} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-[#F8F7F4]">
                  {last ? 'Start' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
