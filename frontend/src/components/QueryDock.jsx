import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Keyboard, CornerDownLeft, X, ArrowUpRight } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';
import { SAMPLES, KIND_STYLE } from '../lib/samples';

const TEMPLATES = [
  { label: 'GR No. search', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
  { label: 'Pay & allowances', text: 'Pay fixation: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading, compact, focusSignal }) {
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
      <div className="glass-card relative rounded-2xl p-2.5 shadow-lift focus-within:border-iris-400 focus-within:shadow-[0_0_0_1px_rgba(79,70,229,0.45),0_12px_28px_-12px_rgba(79,70,229,0.3)] transition-all">
        <div className="flex items-start gap-2.5">
          <div className="mt-2.5 grid h-8 w-8 place-items-center rounded-xl bg-iris-50 border border-iris-100 text-iris-600 shrink-0">
            <Search className="h-4 w-4" />
          </div>

          <textarea
            ref={ref}
            id="question-input"
            rows={compact ? 2 : 3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask in Gujarati, English or Gujlish — e.g. “પ્રસૂતિ રજા માટે કયા documents જોઈએ?” or “CRR 2008 maternity rules”"
            aria-label="Your question"
            maxLength={2000}
            className="gu-text max-h-44 min-h-[3.2rem] flex-1 resize-none bg-transparent py-1.5 text-[14.5px] font-normal text-legal placeholder:text-[#8A94A6] outline-none leading-relaxed"
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_-2px_rgba(79,70,229,0.5)] transition hover:brightness-110 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                <span>{loading ? 'Analyzing…' : 'Investigate'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline font-mono text-[10px] text-mist/80">Enter ↵</span>
              <button
                type="button"
                onClick={() => setKb((v) => !v)}
                className={`gu-text inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  kb
                    ? 'border-teal-300 bg-teal-50 text-teal-800'
                    : 'border-hair bg-sand/60 text-mist hover:text-legal hover:bg-sand'
                }`}
                aria-pressed={kb}
              >
                <Keyboard className="h-3 w-3 text-teal-600" />
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
      <div className="flex flex-wrap items-center gap-1.5 px-0.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-mist mr-1">Starters:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              onChange(t.text);
              ref.current?.focus();
            }}
            className="rounded-full border border-hair bg-white px-2.5 py-0.5 text-[11px] font-medium text-mist transition hover:border-iris-300 hover:text-iris-700 hover:bg-iris-50/50"
          >
            {t.label}
          </button>
        ))}

        {compact && (
          <>
            <span className="mx-1 h-3 w-px bg-hair" />
            {SAMPLES.slice(0, 3).map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onSubmit(s.text, true)}
                disabled={loading}
                title={s.text}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition hover:brightness-95 disabled:opacity-40 ${
                  KIND_STYLE[s.kind].chip
                } ${s.kind === 'gu' ? 'gu-text' : ''}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[s.kind].dot}`} />
                <span>{s.label}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
