import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownLeft, X, Keyboard, Loader2, Mic, MicOff } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';
import HistoryMenu from './HistoryMenu';
import { speechRecognitionConstructor, recognitionLocale, appendTranscript } from '../lib/speechInput';
import { useUiLanguage } from '../lib/i18n';

const TEMPLATES = [
  { label: 'GR No. search', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
  { label: 'Pay & allowances', text: 'Pay fixation: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading, compact, focusSignal, hero = false, history = [], onOpenHistory, onClearHistory }) {
  const { language: uiLanguage, t } = useUiLanguage();
  const [kb, setKb] = useState(false);
  const [dictationLanguage, setDictationLanguage] = useState(uiLanguage);
  const [listening, setListening] = useState(false);
  const [dictationError, setDictationError] = useState('');
  const ref = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    recognitionRef.current?.stop();
    setDictationLanguage(uiLanguage);
  }, [uiLanguage]);

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

  const toggleDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setDictationError(t('speechUnsupported'));
      return;
    }

    const recognition = new Recognition();
    recognition.lang = recognitionLocale(dictationLanguage);
    recognition.continuous = true;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    setDictationError('');
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript?.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) {
        onChange((current) => appendTranscript(current, transcript));
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setDictationError(t('speechPermission'));
      } else if (event.error === 'no-speech') {
        setDictationError(t('speechNoResult'));
      } else if (event.error !== 'aborted') {
        setDictationError(t('speechFailed'));
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
    } catch (error) {
      recognitionRef.current = null;
      setListening(false);
      setDictationError(error?.name === 'NotAllowedError' ? t('speechPermission') : t('speechFailed'));
    }
  };

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
  }, []);

  return (
    <div className="space-y-3 print:hidden" data-tour="ask">
      <div
        className={`glass-dock group/dock transition-all duration-200 focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/15 focus-within:[box-shadow:0_10px_32px_-6px_rgba(79,70,229,0.22)] ${
          hero ? 'rounded-[22px] p-4' : 'rounded-2xl p-3.5'
        }`}
      >
        {hero && (
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="mono-label text-[#64748B]">{t('officialInquiry')}</span>
            <span className="hidden items-center gap-1.5 text-[11px] text-[#64748B] sm:flex">
              <kbd className="kbd">/</kbd> to focus
            </span>
          </div>
        )}

        <div className="space-y-2.5">
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
            placeholder={hero ? t('askAnyResolution') : t('askFollowup')}
            aria-label={t('yourQuestion')}
            maxLength={2000}
            className={`gu-text block max-h-48 min-h-[3rem] w-full min-w-0 resize-y bg-transparent px-1.5 py-1 text-[15px] font-normal leading-relaxed text-[#1E293B] outline-none placeholder:text-[#64748B]/60 ${
              hero ? 'min-h-[4.2rem] text-[17px]' : 'min-h-[3rem]'
            }`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6E4DD]/70 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
            <label className="sr-only" htmlFor={hero ? 'hero-dictation-language' : 'question-dictation-language'}>{t('dictationLanguage')}</label>
            <select
              id={hero ? 'hero-dictation-language' : 'question-dictation-language'}
              value={dictationLanguage}
              onChange={(event) => setDictationLanguage(event.target.value)}
              disabled={listening}
              aria-label={t('dictationLanguage')}
              className="max-w-[7.5rem] rounded-lg border border-[#E6E4DD] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#64748B]"
            >
              <option value="en">{t('english')}</option>
              <option value="gu">{t('gujarati')}</option>
              <option value="gujlish">{t('gujlish')}</option>
            </select>
            <button
              type="button"
              onClick={toggleDictation}
              aria-label={listening ? t('stopDictation') : t('listenQuestion')}
              title={listening ? t('stopDictation') : t('listenQuestion')}
              aria-pressed={listening}
              className={`rounded-lg border p-1.5 transition ${listening ? 'border-[#F43F5E] bg-[#FFF1F2] text-[#BE123C]' : 'border-[#E6E4DD] bg-white text-[#4F46E5] hover:bg-[#EEF2FF]'}`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            {value.trim() && !loading && (
              <button
                type="button"
                onClick={clear}
                aria-label={t('clearQuestion')}
                title={t('clearInput')}
                className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#F1EFEA] hover:text-[#1E293B]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <HistoryMenu history={history} onOpen={onOpenHistory} onClear={onClearHistory} />
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
              <motion.button
                type="button"
                onClick={submit}
                disabled={!value.trim() || loading}
                whileTap={{ scale: 0.97 }}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                <span>{loading ? t('searching') : t('ask')}</span>
              </motion.button>
            </div>

            {(dictationError || listening || dictationLanguage === 'gujlish') && (
              <p role={dictationError ? 'alert' : 'status'} className={`w-full px-1 text-[11px] ${dictationError ? 'text-[#9F1239]' : 'text-[#64748B]'}`}>
                {dictationError || (listening ? t('listening') : t('gujlishDictationHint'))}
              </p>
            )}
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
          <span className="mr-0.5 text-[11.5px] font-medium text-[#64748B]">{t('quickExamples')}</span>
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
