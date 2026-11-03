import React, { useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, Sparkles } from 'lucide-react';

// Spotlight tour for judges and executives. Each step points at an element marked data-tour="...".
export const TOUR_STEPS = [
  {
    target: 'rail',
    title: 'Executive Workspaces',
    text: 'Seamlessly switch between Inquiry (Ask), the Resolution Library, and the Method & Benchmark scorecard.',
  },
  {
    target: 'ask',
    title: 'Multi-Script Legal Search',
    text: 'Type questions naturally in ગુજરાતી, English, or Gujlish. Press / anywhere on your keyboard to instantly focus.',
  },
  {
    target: 'answer',
    title: 'Deterministic Status & Grounding',
    text: 'Every answer displays a verified status: No later change, Amended, Superseded, or Refused. It never claims a rule is in force.',
  },
  {
    target: 'evidence',
    title: 'Verbatim Evidence Inspector',
    text: 'The official Government Resolution opens automatically on the cited page with the illuminated paragraph bounding box.',
  },
  {
    target: 'timemachine',
    title: 'Rule Time Machine',
    text: 'Select any historical date to travel back in time and view which amendments were promulgated as of that day.',
  },
];

const PAD = 8;

function useRect(target, open) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect(r.width && r.height ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null);
    };

    measure();
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 400);
    return () => {
      window.removeEventListener('resize', measure);
      clearInterval(t);
    };
  }, [target, open]);

  return rect;
}

export default function Tour({ open, onClose }) {
  const [i, setI] = useState(0);
  const step = TOUR_STEPS[i];
  const rect = useRect(step.target, open);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

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
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let pos = { left: vw / 2 - 175, top: vh / 2 - 90 };

  if (rect) {
    if (rect.x + rect.w + 370 < vw) pos = { left: rect.x + rect.w + 16, top: Math.min(Math.max(16, rect.y), vh - 220) };
    else if (rect.x - 370 > 0) pos = { left: rect.x - 364, top: Math.min(Math.max(16, rect.y), vh - 220) };
    else if (rect.y + rect.h + 220 < vh) pos = { left: Math.min(Math.max(16, rect.x), vw - 366), top: rect.y + rect.h + 16 };
    else pos = { left: Math.min(Math.max(16, rect.x), vw - 366), top: Math.max(16, rect.y - 220) };
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Guided tour"
        >
          {rect ? (
            <motion.div
              className="pointer-events-none absolute rounded-2xl"
              style={{ boxShadow: '0 0 0 2px #818CF8, 0 0 0 6px rgba(129,140,248,.25), 0 0 0 9999px rgba(30, 41, 59, 0.42)' }}
              animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            />
          ) : (
            <div className="absolute inset-0 bg-[rgba(30,41,59,0.42)]" />
          )}

          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="sheet absolute w-[350px] p-5 shadow-float"
            style={pos}
          >
            <div className="mb-2 flex items-center justify-between pb-1.5 border-b border-hair">
              <span className="mono-label flex items-center gap-1.5 text-iris-700">
                <Sparkles className="h-3 w-3" /> Tour · {i + 1} / {TOUR_STEPS.length}
              </span>
              <button
                onClick={onClose}
                aria-label="Close tour"
                className="rounded-lg p-1 text-mist hover:text-legal hover:bg-sand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="display text-[18px] font-bold text-ink">{step.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-mist">{step.text}</p>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-hair/70">
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, n) => (
                  <span
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${
                      n === i ? 'w-5 bg-iris-600' : 'w-1.5 bg-stone'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {i > 0 && (
                  <button
                    onClick={() => setI(i - 1)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-mist hover:text-legal hover:bg-sand"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => (last ? onClose() : setI(i + 1))}
                  className="inline-flex items-center gap-1.5 btn-primary rounded-xl px-3.5 py-1.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                >
                  <span>{last ? 'Get Started' : 'Next'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
