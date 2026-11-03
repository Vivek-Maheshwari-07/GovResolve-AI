import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownLeft, X, Keyboard, Loader2 } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';
import HistoryMenu from './HistoryMenu';

const TEMPLATES = [
  { label: 'GR No. search', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
  { label: 'Pay & allowances', text: 'Pay fixation: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading, compact, focusSignal, hero = false, history = [], onOpenHistory, onClearHistory }) {
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
    <div className="space-y-3" data-tour="ask">
      <div
        className={`sheet group/dock transition-shadow focus-within:[box-shadow:0_0_0_1.5px_#4F46E5,0_0_0_6px_rgba(79,70,229,0.12),0_24px_48px_-20px_rgba(79,70,229,0.45)] ${hero ? 'rounded-[22px] p-3.5' : 'rounded-2xl p-3'}`}
      >
        {hero && (
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="mono-label text-faint">Inquiry · ગુજરાતી / English / Gujlish</span>
            <span className="hidden items-center gap-1.5 text-[11px] text-faint sm:flex">
              <kbd className="kbd">/</kbd> to focus
            </span>
          </div>
        )}

        <div className="flex items-start gap-3">
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
            className={`gu-text max-h-44 flex-1 resize-none bg-transparent px-1 py-1.5 font-normal text-ink outline-none placeholder:text-faint ${hero ? 'min-h-[4rem] text-[17px]' : 'min-h-[2.9rem] text-[14.5px]'}`}
          />

          <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              {value.trim() && !loading && (
                <button type="button" onClick={clear} aria-label="Clear question" title="Clear input" className="rounded-lg p-1.5 text-mist transition hover:bg-sand hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
              <motion.button
                type="button"
                onClick={submit}
                disabled={!value.trim() || loading}
                whileTap={{ scale: 0.97 }}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                <span>{loading ? 'Searching…' : 'Ask'}</span>
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              <HistoryMenu history={history} onOpen={onOpenHistory} onClear={onClearHistory} />
              <span className="hidden text-[10.5px] text-faint sm:inline">Enter to send</span>
              <button
                type="button"
                onClick={() => setKb((v) => !v)}
                className={`gu-text inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors ${kb ? 'bg-iris-50 text-iris-800 ring-1 ring-iris-200' : 'bg-sand text-mist ring-1 ring-stone hover:text-ink'}`}
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

      {hero && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5">
          <span className="mr-1 text-[11.5px] font-medium text-mist">Start with</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onChange(t.text);
                ref.current?.focus();
              }}
              className="rounded-full bg-ivory px-3 py-1 text-[12px] font-medium text-mist transition hover:text-iris-700 hover:[box-shadow:0_0_0_1px_#A5B4FC]"
              style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.09), inset 0 1px 0 #fff' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
