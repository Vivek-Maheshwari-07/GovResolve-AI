import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, X, Loader2, Check } from 'lucide-react';

/**
 * Guided tour that runs on the live application. Each step spotlights a real element (marked data-tour="...").
 * Steps can drive the app: the "ask" step types a sample question and sends it, and later steps wait for the answer.
 * The area inside the spotlight stays clickable, so a visitor can try the highlighted control.
 *
 * ctx: { hasAnswer, hasCitations, hasLineage, loading, typeAndAsk(), setWorkspace(ws) }
 */
export const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'A two-minute walk',
    text: 'We will ask one question for you, then follow the answer from its verdict down to the page it came from. The answer is produced by the same system you are about to use.',
  },
  {
    id: 'rail',
    target: 'rail',
    place: 'right',
    title: 'Three workspaces',
    text: 'Inquiry is where you ask. The Library lists every indexed resolution with its status. Method shows how answers are built and how they scored in our own tests.',
  },
  {
    id: 'ask',
    target: 'ask',
    action: 'ask',
    title: 'Ask in any language',
    text: 'Gujarati, English, or a mix. We are typing a sample question now. The on-screen Gujarati keypad is one tap away, and the language switch in the header can pin the language.',
  },
  {
    id: 'verdict',
    target: 'verdict',
    needs: 'answer',
    title: 'The verdict comes first',
    text: 'Every answer opens with a seal: No later change, Amended, Superseded, Conflict or Insufficient evidence. It describes the documents we hold. It never claims a rule is in force.',
  },
  {
    id: 'finding',
    target: 'finding',
    needs: 'answer',
    place: 'right',
    title: 'The finding and its Trust Shield',
    text: 'Statements are labelled Established or Inferred. The Trust Shield counts the verbatim quotes, the resolutions behind them and the lineage checks that were run.',
  },
  {
    id: 'passages',
    target: 'passages',
    needs: 'citations',
    place: 'right',
    title: 'Verbatim passages',
    text: 'Each quote is copied from the source page with its GR number, issue date and page. Select one to lock it on the original document.',
  },
  {
    id: 'evidence',
    target: 'evidence',
    needs: 'citations',
    place: 'left',
    title: 'The page, with the paragraph locked',
    text: 'The original opens on the cited page with the exact paragraph framed. Switch between Scan and Text to compare the original with the OCR, or copy a court-ready citation.',
  },
  {
    id: 'lineage',
    target: 'lineage',
    needs: 'lineage',
    place: 'right',
    title: 'What happened next',
    text: 'Arrows run from the newer order to the older one it changes. Click a link to read the clause behind it, and drag the handle underneath to see the chain as it stood on any date.',
  },
  {
    id: 'timemachine',
    target: 'timemachine',
    place: 'below',
    title: 'Rules as of any day',
    text: 'Choose a date and every status is recomputed from the orders’ own issue dates. Orders issued later are dimmed as not yet issued.',
  },
  {
    id: 'library',
    target: 'library',
    action: 'workspace:library',
    place: 'right',
    title: 'The Library',
    text: 'Search by GR number, subject or year, and filter by language, department and status. Open a row to read the document and trace its amendments.',
  },
  {
    id: 'done',
    final: true,
    action: 'workspace:ask',
    title: 'That is the whole loop',
    text: 'Ask, read the verdict, check the quote on its page, follow the chain. Your sample answer is still on screen. Ask your own question next, or press ? any time to replay this tour.',
    cta: 'Open the application',
  },
];

const PAD = 10;
const CARD_W = 372;
const satisfied = (needs, ctx) => !needs || (needs === 'answer' ? ctx.hasAnswer : needs === 'citations' ? ctx.hasCitations : ctx.hasLineage);

function useTargetRect(target, open, stepKey) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!open || !target) {
      setRect(null);
      return undefined;
    }
    let scrolled = false;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      if (!scrolled && target !== 'rail' && target !== 'timemachine' && target !== 'ask') {
        scrolled = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!r.width || !r.height) {
        setRect(null);
        return;
      }
      const x = Math.max(8, r.left - PAD);
      const y = Math.max(8, r.top - PAD);
      const x2 = Math.min(vw - 8, r.right + PAD);
      const y2 = Math.min(vh - 8, r.bottom + PAD);
      setRect((prev) => (prev && Math.abs(prev.x - x) < 1 && Math.abs(prev.y - y) < 1 && Math.abs(prev.w - (x2 - x)) < 1 && Math.abs(prev.h - (y2 - y)) < 1 ? prev : { x, y, w: Math.max(40, x2 - x), h: Math.max(40, y2 - y) }));
    };
    measure();
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 220);
    return () => {
      window.removeEventListener('resize', measure);
      clearInterval(t);
    };
  }, [target, open, stepKey]);

  return rect;
}

export default function Tour({ open, onClose, ctx = {} }) {
  const [i, setI] = useState(0);
  const [waited, setWaited] = useState(0);
  const [cardH, setCardH] = useState(260);
  const cardRef = useRef(null);
  const ran = useRef({});
  const step = TOUR_STEPS[i];
  const rect = useTargetRect(step.target, open, `${i}:${ctx.hasAnswer}:${ctx.loading}`);
  const ready = satisfied(step.needs, ctx);
  const last = i === TOUR_STEPS.length - 1;

  const go = useCallback((d) => {
    setI((n) => {
      let k = n + d;
      while (k > 0 && k < TOUR_STEPS.length - 1 && TOUR_STEPS[k].needs && !satisfied(TOUR_STEPS[k].needs, ctxRef.current) && !ctxRef.current.loading) k += d;
      return Math.max(0, Math.min(TOUR_STEPS.length - 1, k));
    });
  }, []);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // a new run starts at the first step
  useEffect(() => {
    if (open) {
      setI(0);
      ran.current = {};
    }
  }, [open]);

  // steps that drive the app run once
  useEffect(() => {
    if (!open || !step.action || ran.current[step.id]) return;
    ran.current[step.id] = true;
    if (step.action === 'ask') { if (!ctx.hasAnswer) ctx.typeAndAsk?.(); }
    else if (step.action.startsWith('workspace:')) ctx.setWorkspace?.(step.action.split(':')[1]);
  }, [open, step, ctx]);

  // a step that needs an answer which is not coming (error, refusal): move on
  useEffect(() => {
    if (open && step.needs && !ready && !ctx.loading && ran.current.ask) go(1);
  }, [open, step, ready, ctx.loading, go]);

  // how long we have been waiting for an answer
  useEffect(() => {
    setWaited(0);
    if (!open || !step.needs || ready) return undefined;
    const t = setInterval(() => setWaited((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open, step, ready]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'ArrowRight' && ready && !last) go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, go, ready, last]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, ready, waited > 15]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const sheet = vw < 720;
  let pos = { left: vw / 2 - CARD_W / 2, top: Math.max(24, vh / 2 - cardH / 2) };
  if (sheet) pos = { left: 12, right: 12, bottom: 12, top: 'auto', width: 'auto' };
  else if (rect) {
    const fit = {
      right: rect.x + rect.w + 18 + CARD_W < vw,
      left: rect.x - 18 - CARD_W > 0,
      below: rect.y + rect.h + 18 + cardH < vh,
      above: rect.y - 18 - cardH > 0,
    };
    const order = [step.place, 'right', 'left', 'below', 'above'].filter(Boolean);
    const side = order.find((s) => fit[s]);
    const clampTop = (t) => Math.min(Math.max(16, t), vh - cardH - 16);
    const clampLeft = (l) => Math.min(Math.max(16, l), vw - CARD_W - 16);
    if (side === 'right') pos = { left: rect.x + rect.w + 18, top: clampTop(rect.y) };
    else if (side === 'left') pos = { left: rect.x - 18 - CARD_W, top: clampTop(rect.y) };
    else if (side === 'below') pos = { left: clampLeft(rect.x), top: rect.y + rect.h + 18 };
    else if (side === 'above') pos = { left: clampLeft(rect.x), top: rect.y - 18 - cardH };
    else pos = { left: vw - CARD_W - 24, top: vh - cardH - 24 }; // the target fills the screen: park the card in the corner
  }

  const waiting = step.needs && !ready && ctx.loading;
  const dims = rect
    ? [
        { left: 0, top: 0, width: vw, height: rect.y },
        { left: 0, top: rect.y + rect.h, width: vw, height: Math.max(0, vh - rect.y - rect.h) },
        { left: 0, top: rect.y, width: rect.x, height: rect.h },
        { left: rect.x + rect.w, top: rect.y, width: Math.max(0, vw - rect.x - rect.w), height: rect.h },
      ]
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Guided tour" data-tour-open>
          {rect ? (
            <>
              {/* the hole stays clickable; everything around it is blocked */}
              {dims.map((d, k) => <div key={k} className="absolute" style={d} onClick={(e) => e.stopPropagation()} />)}
              <motion.div
                className="pointer-events-none absolute rounded-[18px]"
                style={{ boxShadow: '0 0 0 2px #818CF8, 0 0 0 7px rgba(129,140,248,.28), 0 0 0 9999px rgba(30, 41, 59, 0.5)' }}
                initial={false}
                animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                transition={{ type: 'spring', stiffness: 230, damping: 28 }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-[rgba(30,41,59,0.5)] backdrop-blur-[2px]" />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              ref={cardRef}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="sheet absolute p-5 shadow-float"
              style={{ width: sheet ? undefined : CARD_W, ...pos }}
            >
              <div className="flex items-center justify-between">
                <span className="mono-label text-iris-700">Tour · {i + 1} of {TOUR_STEPS.length}</span>
                <button onClick={() => onClose(false)} aria-label="Close tour" className="rounded-lg p-1 text-mist hover:bg-sand hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex gap-1" aria-hidden>
                {TOUR_STEPS.map((s, n) => (
                  <span key={s.id} className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${n < i ? 'bg-iris-400' : n === i ? 'bg-iris-600' : 'bg-stone'}`} />
                ))}
              </div>

              <h3 className="display mt-4 text-[19px] font-bold leading-snug text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-mist">{step.text}</p>

              {waiting && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-iris-50 px-3 py-2.5 text-[12.5px] text-iris-800" role="status">
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span>
                    Waiting for the answer. A local model can take up to a minute.
                    {waited > 15 && (
                      <>
                        {' '}
                        <button type="button" onClick={() => setI(TOUR_STEPS.findIndex((s) => s.id === 'timemachine'))} className="font-semibold underline underline-offset-2">Skip this part</button>
                      </>
                    )}
                  </span>
                </div>
              )}
              {step.id === 'ask' && ctx.hasAnswer && (
                <p className="mt-3 flex items-center gap-2 text-[12.5px] font-medium text-[#2F5D4E]"><Check className="h-3.5 w-3.5" /> The answer is in.</p>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-hair pt-3">
                {last ? <span /> : <button onClick={() => onClose(false)} className="text-[12px] font-medium text-faint underline decoration-stone underline-offset-4 hover:text-ink">Skip tour</button>}
                <div className="flex gap-2">
                  {i > 0 && (
                    <button onClick={() => go(-1)} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-mist hover:bg-sand hover:text-ink">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                  )}
                  <button
                    onClick={() => (last ? onClose(true) : go(1))}
                    disabled={!ready && !last}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>{last ? step.cta : i === 0 ? 'Start the tour' : 'Next'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
