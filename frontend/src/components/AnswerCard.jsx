import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, TriangleAlert, ShieldCheck, MessageSquareWarning,
  ArrowRight, ChevronDown, ChevronUp, Quote, Layers,
  Printer, Volume2, Square, Languages, Loader2,
} from 'lucide-react';
import Seal from './Seal';
import TrustShield from './TrustShield';
import { loadSpeechVoices, speechLocale, speechVoiceForLocale } from '../lib/speech';
import { useUiLanguage } from '../lib/i18n';
import { useLanguage, useT } from '../lib/LanguageContext';
import { pickSubject } from '../lib/bilingualStrings';
import { displayQuote, looksGarbled } from '../lib/quote';
import { translateText } from '../api';

export const citeKey = (c) => (c ? `${c.gr_id}|${c.page}|${c.passage || ''}` : '');

const LABELS = {
  Established: { cls: 'badge-safe', dot: 'bg-[#10B981]', note: 'Directly supported by a cited passage' },
  Inferred: { cls: 'badge-caution', dot: 'bg-[#F59E0B]', note: 'Reasoned from the passages, not stated in them' },
  Unverified: { cls: 'badge-danger', dot: 'bg-[#F43F5E]', note: 'Not found in the documents' },
};
const labelOf = (l) => (l === 'Not found' ? 'Unverified' : l);
const sealOf = (c) => (c?.lineage?.status === 'superseded' ? 'superseded' : c?.lineage?.status === 'amended' ? 'amended' : 'no_change');

const hasGujaratiScript = (s) => /[\u0A80-\u0AFF]/.test(s || '');

function CitationChip({ cit, active, onSelect, uiLang }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(cit)}
      aria-pressed={active}
      title={pickSubject(cit, uiLang) || cit.gr_number}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-all ${
        active
          ? 'bg-[#EEF2FF] text-[#4F46E5] ring-1.5 ring-[#4F46E5] shadow-[0_2px_8px_-2px_rgba(79,70,229,0.25)]'
          : 'bg-[rgba(255,255,255,0.92)] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F46E5] border border-[#E6E4DD]'
      }`}
      style={{
        boxShadow: active ? undefined : '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      <FileText className="h-3 w-3 shrink-0 text-[#4F46E5]" />
      <span className="truncate font-mono font-semibold text-[#1E293B]">{cit.gr_number || cit.gr_id}</span>
      <span className="opacity-40 text-[#64748B]">·</span>
      <span className="shrink-0 font-mono font-semibold text-[#64748B]">p.{cit.page}</span>
    </motion.button>
  );
}

export default function AnswerCard({ response, active, onSelect, language, onLanguageChange, onAsk, onOpenDoc }) {
  const { t } = useUiLanguage();
  const tb = useT();
  const { lang: uiLang } = useLanguage();
  // the meaning of a quote in the interface language, on request; the quote itself always stays verbatim
  const [quoteHelp, setQuoteHelp] = useState({}); // key -> { open, loading, text }
  useEffect(() => { setQuoteHelp({}); }, [response]);
  const toggleQuoteTranslation = async (e, c, targetLang) => {
    e.stopPropagation();
    const k = `${citeKey(c)}:${targetLang}`;
    const cur = quoteHelp[k];
    if (cur?.text) {
      setQuoteHelp((p) => ({ ...p, [k]: { ...cur, open: !cur.open } }));
      return;
    }
    if (cur?.loading) return;
    setQuoteHelp((p) => ({ ...p, [k]: { open: true, loading: true, text: '' } }));
    try {
      const tr = await translateText(c.passage, targetLang);
      setQuoteHelp((p) => ({ ...p, [k]: { open: true, loading: false, text: tr } }));
    } catch {
      setQuoteHelp((p) => ({ ...p, [k]: { open: false, loading: false, text: '' } }));
    }
  };
  const answered = response.verdict === 'answered';
  const warnings = response.warnings || [];
  const isGu = /[઀-૿]/.test(response.summary || response.insufficient_reason || '');
  const answerLanguage = ['en', 'gu', 'gujlish'].includes(language)
    ? language
    : ['en', 'gu', 'gujlish'].includes(response.language)
      ? response.language
      : (isGu ? 'gu' : 'en');
  const speechText = answered ? response.summary : response.insufficient_reason;
  const citations = response.citations || [];
  const statements = response.statements || [];

  const [activeTab, setActiveTab] = useState('passages');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [speakingTarget, setSpeakingTarget] = useState(null);
  const [speechError, setSpeechError] = useState('');
  const [speechErrorTarget, setSpeechErrorTarget] = useState(null);
  const [speechVoices, setSpeechVoices] = useState([]);
  const speechRun = useRef(0);

  React.useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const synthesis = window.speechSynthesis;
    const updateVoices = () => setSpeechVoices(synthesis.getVoices());
    updateVoices();
    synthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => synthesis.removeEventListener?.('voiceschanged', updateVoices);
  }, []);

  React.useEffect(() => {
    setSpeakingTarget(null);
    setSpeechError('');
    setSpeechErrorTarget(null);
    return () => {
      speechRun.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, [speechText, citations]);

  const speakItems = (items, target) => {
    const queue = items.filter((item) => typeof item.text === 'string' && item.text.trim());
    if (!queue.length) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechError(t('speechPlaybackUnsupported'));
      setSpeechErrorTarget(target);
      return;
    }

    const synthesis = window.speechSynthesis;
    const run = ++speechRun.current;
    synthesis.cancel();
    setSpeakingTarget(target);
    setSpeechError('');
    setSpeechErrorTarget(null);
    (speechVoices.length ? Promise.resolve(speechVoices) : loadSpeechVoices(synthesis)).then((voices) => {
      if (run !== speechRun.current) return;
      const voiceItems = queue.map((item) => ({
        voice: speechVoiceForLocale(voices, speechLocale(item.language, item.text)),
      }));
      if (voiceItems.some(({ voice }) => !voice)) {
        setSpeakingTarget(null);
        setSpeechError(t('speechVoiceUnavailable'));
        setSpeechErrorTarget(target);
        return;
      }

      let index = 0;
      const speakNext = () => {
        if (run !== speechRun.current) return;
        if (index >= queue.length) {
          setSpeakingTarget(null);
          return;
        }

        const item = queue[index];
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = speechLocale(item.language, item.text);
        utterance.voice = voiceItems[index].voice;
        index += 1;
        utterance.onend = speakNext;
        utterance.onerror = (event) => {
          if (run !== speechRun.current) return;
          setSpeakingTarget(null);
          if (event.error === 'language-unavailable' || event.error === 'voice-unavailable') {
            setSpeechError(t('speechVoiceUnavailable'));
            setSpeechErrorTarget(target);
          } else if (event.error !== 'canceled' && event.error !== 'interrupted') {
            setSpeechError(t('speechPlaybackFailed'));
            setSpeechErrorTarget(target);
          }
        };
        synthesis.speak(utterance);
      };

      speakNext();
    }).catch(() => {
      if (run !== speechRun.current) return;
      setSpeakingTarget(null);
      setSpeechError(t('speechPlaybackFailed'));
      setSpeechErrorTarget(target);
    });
  };

  const speak = () => speakItems([{ text: speechText, language: answerLanguage }], 'answer');
  const speakPassages = () => speakItems(
    citations.map((citation) => ({ text: citation.passage, language: citation.language })),
    'passages',
  );

  const stopSpeaking = () => {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    setSpeakingTarget(null);
  };

  return (
    <div className="space-y-3">
      {/* Warnings alert */}
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="overflow-hidden rounded-xl border border-[#FDE68A] border-l-[4px] border-l-[#F59E0B] bg-[#FFFBEB] shadow-sm"
        >
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 px-4 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#92400E] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[#FDE68A]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
              <span>{w}</span>
            </p>
          ))}
        </motion.div>
      )}

      {/* Primary Finding Card */}
      <section data-tour="finding" className="sheet px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className={`eyebrow flex items-center gap-1.5 ${answered ? '!text-[#4F46E5]' : '!text-[#64748B]'}`}>
              {answered ? <span className="h-2 w-2 rounded-full bg-[#4F46E5]" /> : <MessageSquareWarning className="h-3.5 w-3.5 text-[#64748B]" />}
              {answered ? t('adminFinding') : t('whyNoFinding')}
            </h2>
            {onLanguageChange && (
              <div
                role="group"
                aria-label={t('answerLanguage')}
                className="inline-flex items-center rounded-lg bg-[#F1EFEA] p-0.5 text-[11px]"
                style={{ boxShadow: 'inset 0 1px 2px rgba(30,41,59,.07)' }}
              >
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`rounded-md px-2 py-0.5 font-semibold transition-all ${
                    answerLanguage === 'en'
                      ? 'bg-white text-[#4F46E5] shadow-sm ring-1 ring-black/5'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                  title={t('showAnswerInEnglish')}
                >
                  {t('english')}
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('gu')}
                  className={`gu-text rounded-md px-2 py-0.5 font-semibold transition-all ${
                    answerLanguage === 'gu'
                      ? 'bg-white text-[#4F46E5] shadow-sm ring-1 ring-black/5'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                  title={t('showAnswerInGujarati')}
                >
                  {t('gujarati')}
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('gujlish')}
                  className={`rounded-md px-2 py-0.5 font-semibold transition-all ${
                    answerLanguage === 'gujlish'
                      ? 'bg-white text-[#4F46E5] shadow-sm ring-1 ring-black/5'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                  title={t('showAnswerInGujlish')}
                >
                  {t('gujlish')}
                </button>
              </div>
            )}
            <span className="telemetry-tag hidden sm:inline text-[9px] text-[#64748B]">· [LEGAL_EXTRACT]</span>
          </div>
          <div className="flex items-center gap-2">
            {speechText && (
              <button
                type="button"
                onClick={speakingTarget === 'answer' ? stopSpeaking : speak}
                aria-label={speakingTarget === 'answer' ? t('stopSpeakingAnswer') : t('listenToAnswer')}
                title={speakingTarget === 'answer' ? t('stop') : `${t('listen')} (${speechLocale(answerLanguage, speechText)})`}
                className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2.5 py-1 text-[11.5px] font-semibold text-[#1E293B] shadow-sm hover:border-[#4F46E5] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-all"
              >
                {speakingTarget === 'answer' ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5 text-[#4F46E5]" />}
                <span>{speakingTarget === 'answer' ? t('stop') : t('listen')}</span>
              </button>
            )}
            {answered && citations.length > 0 && !/retrieval-only|answer engine (not connected|unavailable)/i.test([response.summary, ...(response.warnings || [])].join(' ')) && (
              <span className="inline-flex items-center gap-1.5 rounded-full badge-safe px-2.5 py-0.5 text-[11px] font-semibold shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" /> {t('verifiedOfficialText')}
              </span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              title={t('exportActionMemo')}
              aria-label={t('exportActionMemo')}
              className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2.5 py-1 text-[11.5px] font-semibold text-[#1E293B] shadow-sm hover:border-[#4F46E5] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-all"
            >
              <Printer className="h-3.5 w-3.5 text-[#4F46E5]" />
              <span>{t('exportActionMemo')}</span>
            </button>
          </div>
        </div>
        <p className={`${isGu ? 'gu-text' : 'display'} text-[19px] font-normal leading-[1.62] text-[#1E293B] sm:text-[21px]`}>
          {answered ? response.summary : response.insufficient_reason}
        </p>
        {speechError && speechErrorTarget === 'answer' && <p role="status" className="mt-2 text-[11.5px] text-[#9F1239]">{speechError}</p>}
        <TrustShield response={response} />
        {!answered && ((response.follow_up_options || []).length > 0 || (response.suggestions || []).length > 0) && (
          <div className="mt-5 space-y-5 border-t border-[#E6E4DD] pt-4 print:hidden">
            {(response.follow_up_options || []).length > 0 && onAsk && (
              <div>
                <h3 className="eyebrow">{t('tryOneOfThese')}</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {response.follow_up_options.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => onAsk(q)}
                        className={`${/[઀-૿]/.test(q) ? 'gu-text' : ''} w-full rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-3.5 py-2.5 text-left text-[13.5px] font-medium leading-snug text-[#1E293B] transition-colors hover:border-[#4F46E5] hover:bg-[#EEF2FF]/60`}
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(response.suggestions || []).length > 0 && (
              <div>
                <h3 className="eyebrow">{t('closestDocuments')}</h3>
                <p className="mt-1 text-[12px] text-[#64748B]">{t('closestDocumentsNote')}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {response.suggestions.map((s) => (
                    <li key={s.gr_id}>
                      <button
                        type="button"
                        onClick={() => onOpenDoc?.(s)}
                        className="w-full rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-3.5 py-2.5 text-left transition-colors hover:border-[#4F46E5] hover:bg-[#EEF2FF]/60"
                      >
                        <span className="block truncate font-mono text-[12px] font-bold text-[#1E293B]">{s.gr_number}</span>
                        <span className={`${/[઀-૿]/.test(s.subject || '') ? 'gu-text' : ''} mt-0.5 block line-clamp-2 text-[12.5px] text-[#64748B]`}>
                          {s.issue_date ? `${s.issue_date} · ` : ''}{s.subject || ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Segmented Collapsible Evidence Drawer */}
      {answered && (citations.length > 0 || statements.length > 0) && (
        <section data-tour="passages" className="sheet overflow-hidden">
          {/* Drawer control bar */}
          <div className="flex items-center justify-between border-b border-[#E6E4DD] bg-[#F1EFEA]/80 px-4 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="well flex p-0.5" role="tablist" aria-label={t('evidenceViews')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'passages'}
                  onClick={() => { setActiveTab('passages'); setDrawerOpen(true); }}
                  className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11.5px] font-semibold transition-all ${
                    activeTab === 'passages'
                      ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] text-[#4F46E5] shadow-sm'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  <Quote className="h-3.5 w-3.5" />
                  <span>{t('verbatimPassages')}</span>
                  <span className="rounded-full bg-[#EEF2FF] px-1.5 py-0.2 text-[9.5px] font-bold text-[#4F46E5]">
                    {citations.length}
                  </span>
                </button>

                {statements.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'statements'}
                    onClick={() => { setActiveTab('statements'); setDrawerOpen(true); }}
                    className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11.5px] font-semibold transition-all ${
                      activeTab === 'statements'
                        ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] text-[#4F46E5] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>{t('statements')}</span>
                    <span className="rounded-full bg-[#F1EFEA] px-1.5 py-0.2 text-[9.5px] font-bold text-[#64748B]">
                      {statements.length}
                    </span>
                  </button>
                )}
              </div>
              {activeTab === 'passages' && citations.length > 0 && (
                <button
                  type="button"
                  onClick={speakingTarget === 'passages' ? stopSpeaking : speakPassages}
                  aria-label={speakingTarget === 'passages' ? t('stopSpeakingPassages') : t('listenToPassages')}
                  title={speakingTarget === 'passages' ? t('stopSpeakingPassages') : t('listenToPassages')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2.5 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition"
                >
                  {speakingTarget === 'passages' ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
                  <span>{speakingTarget === 'passages' ? t('stop') : t('listen')}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="telemetry-tag hidden sm:inline text-[9px] text-[#64748B]">
                [EVIDENCE_VAULT]
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.90)] px-2.5 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition shadow-xs"
              >
                <span>{drawerOpen ? t('collapse') : t('expand')}</span>
                {drawerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {speechError && speechErrorTarget === 'passages' && (
            <p role="status" className="px-4 py-2 text-[11.5px] text-[#9F1239]">{speechError}</p>
          )}

          {/* Drawer content */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                {/* View 1: Verbatim Legal Excerpt Passages */}
                {activeTab === 'passages' && (
                  <div className="space-y-3 p-3.5 sm:p-5">
                    {citations.map((c, i) => {
                      const on = citeKey(c) === citeKey(active);
                      const subj = pickSubject(c, uiLang);
                      const quoteIsGu = hasGujaratiScript(c.passage);
                      const canTranslate = (uiLang === 'gu' && !quoteIsGu) || (uiLang === 'en' && quoteIsGu);
                      const trTarget = uiLang === 'gu' ? 'gu' : 'en';
                      const helpState = quoteHelp[`${citeKey(c)}:${trTarget}`];
                      return (
                        <motion.div
                          key={i}
                          role="button"
                          tabIndex={0}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => onSelect(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelect(c);
                            }
                          }}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          aria-pressed={on}
                          className={`legal-quote-block group relative block w-full cursor-pointer overflow-hidden p-4 pl-5 text-left transition-all ${
                            on
                              ? 'border-l-[4px] border-l-[#D97706] border-[#FDE68A] bg-[#FFFBEB]/70 ring-1 ring-[#D97706]/30'
                              : 'border-l-[4px] border-l-[#4F46E5]/40 hover:border-l-[#4F46E5] hover:bg-white hover:border-[#C7D2FE]'
                          }`}
                          style={{
                            boxShadow: on
                              ? '0 0 0 1px #D97706, 0 8px 24px -4px rgba(217,119,6,0.18)'
                              : '0 1px 3px rgba(15,23,42,0.03)',
                          }}
                        >
                          <span aria-hidden className="display pointer-events-none absolute -top-3 right-3 select-none text-[64px] leading-none text-[#1E293B]/[0.04]">
                            ”
                          </span>
                          <p className="legal-text relative pl-0.5 text-[14px] leading-relaxed text-[#1E293B]">
                            “{displayQuote(c.passage)}”
                          </p>
                          {looksGarbled(c.passage) && (
                            <p className="relative mt-1.5 text-[11.5px] font-medium text-[#92400E]">
                              This PDF's text layer uses an old Gujarati font, so the stored text reads poorly. Open the page to read the original.
                            </p>
                          )}
                          {helpState?.open && (
                            <div onClick={(e) => e.stopPropagation()} className="relative mt-2.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF]/70 px-3 py-2 text-[12.5px] leading-relaxed text-[#1E293B]">
                              <p className="text-[10.5px] font-semibold text-[#4338CA]">
                                {trTarget === 'gu' ? tb('answer.translation_helper_gu') : tb('answer.translation_helper_en')}
                              </p>
                              <p className={`${trTarget === 'gu' ? 'gu-text' : ''} mt-0.5`}>
                                {helpState.loading ? tb('answer.translating') : helpState.text}
                              </p>
                            </div>
                          )}
                          {(subj || c.department) && (
                            <p className="gu-text relative mt-2 text-[11.5px] leading-snug text-[#64748B]">
                              {subj}{subj && c.department ? ' · ' : ''}{c.department}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6E4DD] pt-2.5">
                            <div className="flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-[#64748B]">
                              <Seal status={sealOf(c)} size={20} />
                              <span className="font-bold text-[#1E293B]">{c.gr_number || c.gr_id}</span>
                              {c.issue_date && <span>{c.issue_date}</span>}
                              <span className="rounded bg-[#F1EFEA] px-1.5 py-0.5 font-bold text-[#1E293B]">p.{c.page}</span>
                              {c.lineage?.status === 'superseded' && <span className="font-bold text-[#9F1239]">{t('superseded')}</span>}
                              {c.lineage?.status === 'amended' && <span className="font-bold text-[#92400E]">{t('amended')}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                            {canTranslate && (
                              <button
                                type="button"
                                onClick={(e) => toggleQuoteTranslation(e, c, trTarget)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E6E4DD] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#4338CA] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]"
                              >
                                {helpState?.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                                <span className={trTarget === 'gu' && !(helpState?.open && !helpState?.loading) ? 'gu-text' : ''}>
                                  {helpState?.open && !helpState?.loading
                                    ? tb('answer.hide_translation')
                                    : trTarget === 'gu' ? tb('answer.translate_gu') : tb('answer.translate_en')}
                                </span>
                              </button>
                            )}
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${on ? 'text-[#D97706]' : 'text-[#4F46E5] group-hover:translate-x-0.5 transition-transform'}`}>
                              {on ? (
                                <>
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inset-0 animate-pingSoft rounded-full bg-[#D97706]" />
                                    <span className="relative h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                                  </span>
                                  {t('lockedOnPage')}
                                </>
                              ) : (
                                <>{t('lockOnPage')} <ArrowRight className="h-3 w-3" /></>
                              )}
                            </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* View 2: Statements & Sources */}
                {activeTab === 'statements' && (
                  <div className="p-3.5 sm:p-5">
                    <ol className="ledger divide-y divide-[#E6E4DD]">
                      {statements.map((st, i) => {
                        const label = labelOf(st.label);
                        const L = LABELS[label] || LABELS.Unverified;
                        const labelKey = label === 'Established' ? 'established' : label === 'Inferred' ? 'inferred' : 'unverified';
                        return (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid grid-cols-[1.8rem_minmax(0,1fr)] gap-2 py-3.5 first:pt-1 last:pb-1"
                          >
                            <span className="pt-0.5 font-mono text-[11px] font-bold text-[#64748B]">¶{i + 1}</span>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <p className="gu-text text-[14px] leading-relaxed text-[#1E293B]">{st.text}</p>
                                <span title={t(`${labelKey}Note`)} className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${L.cls}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${L.dot}`} />
                                  {t(labelKey)}
                                </span>
                              </div>
                              {st.citations.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <span className="mr-0.5 text-[11px] text-[#64748B]">{t('citedIn')}</span>
                                  {st.citations.map((c, j) => (
                                    <CitationChip key={j} cit={c} active={citeKey(c) === citeKey(active)} onSelect={onSelect} uiLang={uiLang} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
