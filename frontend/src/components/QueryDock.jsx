import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Keyboard, CornerDownLeft, X, ArrowUpRight } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';

const TEMPLATES = [
  { label: 'GR No. search', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
  { label: 'Pay & allowances', text: 'Pay fixation: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading, compact, focusSignal, hero = false }) {
  const [kb, setKb] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (focusSignal) ref.current?.focus();
  }, [focusSignal]);

  const submit = () => {
    if (value.trim() && !loading) onSubmit(value.trim());
  };

  const clear = () => {
    onChange('');
    ref.current?.focus();
  };

  return (
    <div className="space-y-2.5" data-tour="ask">
      <div className={`relative border bg-white transition-all focus-within:border-iris-400 focus-within:shadow-[0_0_0_4px_rgba(62,98,230,0.12),0_16px_40px_-16px_rgba(33,57,168,0.35)] ${hero ? 'rounded-[22px] border-stone p-3 shadow-float' : 'rounded-2xl border-hair p-2.5 shadow-lift'}`}>
        <div className="flex items-start gap-2.5">
          <div className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-iris-100 bg-iris-50 text-iris-600">
            <Search className="h-4 w-4" />
          </div>

          <textarea
            ref={ref}
            id="question-input"
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={hero ? 'Ask about any resolution, in any language…' : 'Ask a follow-up or a new question…'}
            aria-label="Your question"
            maxLength={2000}
            className={`gu-text max-h-44 flex-1 resize-none bg-transparent py-2 font-normal text-legal outline-none placeholder:text-[#8B94A5] ${hero ? 'min-h-[3.4rem] text-[16px]' : 'min-h-[2.8rem] text-[14.5px]'}`}
          />

          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              {value.trim() && !loading && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear question"
                  title="Clear input"
                  className="rounded-lg p-1.5 text-mist transition hover:bg-sand hover:text-legal"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!value.trim() || loading}
                className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                <span>{loading ? 'Searching…' : 'Ask'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[10.5px] text-mist/80 sm:inline">Enter to send</span>
              <button
                type="button"
                onClick={() => setKb((v) => !v)}
                className={`gu-text inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  kb
                    ? 'border-iris-300 bg-iris-50 text-iris-800'
                    : 'border-hair bg-sand/60 text-mist hover:text-legal hover:bg-sand'
                }`}
                aria-pressed={kb}
              >
                <Keyboard className="h-3 w-3 text-iris-500" />
                <span>ગુજરાતી</span>
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {kb && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <GujaratiKeyboard
                  onInsert={(ch) => {
                    onChange(ch === '\b' ? [...value].slice(0, -1).join('') : value + ch);
                    ref.current?.focus();
                  }}
                  onClose={() => setKb(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Quick Starters */}
      {hero && (
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-0.5">
        <span className="mr-1 text-[11.5px] font-medium text-mist">Start with</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              onChange(t.text);
              ref.current?.focus();
            }}
            className="rounded-full border border-hair bg-white px-3 py-1 text-[12px] font-medium text-mist transition hover:border-iris-300 hover:bg-iris-50 hover:text-iris-700"
          >
            {t.label}
          </button>
        ))}

      </div>
      )}
    </div>
  );
}
