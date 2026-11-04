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
    <div className="space-y-3 print:hidden" data-tour="ask">
      <div
        className={`glass-dock group/dock transition-all duration-200 focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/15 focus-within:[box-shadow:0_10px_32px_-6px_rgba(79,70,229,0.22)] ${
          hero ? 'rounded-[22px] p-4' : 'rounded-2xl p-3.5'
        }`}
      >
        {hero && (
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="mono-label text-[#64748B]">Official Inquiry · ગુજરાતી / English / Gujlish</span>
            <span className="hidden items-center gap-1.5 text-[11px] text-[#64748B] sm:flex">
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
            placeholder={hero ? 'Ask about any government resolution, in any language…' : 'Ask a follow-up or a new administrative question…'}
            aria-label="Your question"
            maxLength={2000}
            className={`gu-text max-h-48 flex-1 resize-none bg-transparent px-1.5 py-1 text-[15px] font-normal leading-relaxed text-[#1E293B] outline-none placeholder:text-[#64748B]/60 ${
              hero ? 'min-h-[4.2rem] text-[17px]' : 'min-h-[3rem]'
            }`}
          />

          <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              {value.trim() && !loading && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear question"
                  title="Clear input"
                  className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#F1EFEA] hover:text-[#1E293B]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <motion.button
                type="button"
                onClick={submit}
                disabled={!value.trim() || loading}
                whileTap={{ scale: 0.97 }}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                <span>{loading ? 'Searching…' : 'Ask'}</span>
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              <HistoryMenu history={history} onOpen={onOpenHistory} onClear={onClearHistory} />
              <span className="hidden text-[10.5px] text-[#64748B] sm:inline">Enter to send</span>
              <button
                type="button"
                onClick={() => setKb((v) => !v)}
                className={`gu-text inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  kb
                    ? 'border border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] shadow-sm'
                    : 'border border-[#E6E4DD] bg-[#F1EFEA] text-[#64748B] hover:text-[#1E293B] hover:bg-white'
                }`}
                aria-pressed={kb}
              >
                <Keyboard className="h-3 w-3 text-[#4F46E5]" />
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
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="mr-0.5 text-[11.5px] font-medium text-[#64748B]">Quick examples:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onChange(t.text);
                ref.current?.focus();
              }}
              className="rounded-full border border-[#E6E4DD] bg-[rgba(255,255,255,0.90)] px-3.5 py-1 text-[12px] font-medium text-[#64748B] transition-all hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
