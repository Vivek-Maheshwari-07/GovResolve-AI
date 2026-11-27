import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ServerCrash, X, RotateCcw } from 'lucide-react';
import { ask, fetchStats, lineageChain } from './api';
import { statusAsOf } from './lib/lineage';
import { citeKey } from './components/AnswerCard';
import TopBar from './components/TopBar';
import Rail, { MobileTabs } from './components/Rail';
import QueryDock from './components/QueryDock';
import PipelineLoader from './components/PipelineLoader';
import StatusBanner from './components/StatusBanner';
import AnswerCard from './components/AnswerCard';
import LineageGraph from './components/LineageGraph';
import WhatChanged from './components/WhatChanged';
import StageBar from './components/StageBar';
import ChatHelpline from './components/ChatHelpline';
import { isStage, STAGE_PINS } from './lib/stage';
import PdfInspector from './components/PdfInspector';
import Hero, { HeroHeader, Specimen } from './components/AskLanding';
import Library from './components/Library';
import Method from './components/Method';
import Tour from './components/Tour';
import LandingPage from './pages/Hero';
import { SAMPLES } from './lib/samples';
import { LanguageProvider, useUiLanguage } from './lib/i18n';
import { LanguageBridge } from './lib/LanguageContext';
import { HISTORY_MAX, loadHistory, saveHistory } from './lib/history';

const TOUR_KEY = 'govresolve.tour.seen';
const INTRO_KEY = 'govresolve.intro.seen';
const SHORTCUTS = [
  ['/', 'shortcutFocusInquiry'],
  ['1  2  3', 'shortcutWorkspaces'],
  ['[  ]', 'shortcutCitations'],
  ['?', 'shortcutTour'],
  ['Esc', 'shortcutClose'],
];

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode fallback */ }
}
function seenIntro() {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return true; }
}
function rememberIntro() {
  try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode fallback */ }
}
// ?intro=1 always shows the introduction (handy for demos); otherwise only a first visit does
const forceIntro = () => { try { return new URLSearchParams(window.location.search).get('intro') === '1'; } catch { return false; } };
function ShortcutsDialog({ open, onClose }) {
  const { t } = useUiLanguage();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.4)] p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t('keyboardShortcuts')}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="sheet w-full max-w-sm border border-[#E6E4DD] p-5 shadow-float"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#E6E4DD] pb-3">
              <h3 className="display text-[17px] font-bold text-[#1E293B]">{t('keyboardShortcuts')}</h3>
              <button onClick={onClose} aria-label={t('close')} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1EFEA] hover:text-[#1E293B]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2.5">
              {SHORTCUTS.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between text-[13px] text-[#1E293B]">
                  <span>{v}</span>
                  <span className="flex gap-1">{k.split(/\s+/).map((x) => <kbd key={x} className="kbd">{x}</kbd>)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusBar({ onShortcuts, session }) {
  const { t } = useUiLanguage();
  return (
    <footer className="hidden items-center justify-between gap-4 border-t border-[#E6E4DD] bg-[rgba(248,247,244,0.92)] px-4 py-1.5 backdrop-blur-md md:flex shadow-[0_-1px_2px_rgba(15,23,42,0.02)] print:hidden">
      <div className="flex items-center gap-4">
        <button onClick={onShortcuts} className="flex items-center gap-3 text-[11px] text-[#64748B] transition-colors hover:text-[#1E293B]">
          {[['/', 'askWorkspace'], ['1 2 3', 'workspaces'], ['[ ]', 'citations'], ['?', 'tour']].map(([k, v]) => (
            <span key={v} className="flex items-center gap-1.5">
              <span className="flex gap-0.5">{k.split(' ').map((x) => <kbd key={x} className="kbd !h-[18px] !min-w-[18px] !text-[9px]">{x}</kbd>)}</span>
              <span>{t(v)}</span>
            </span>
          ))}
        </button>
        <span className="telemetry-tag hidden xl:inline text-[9px] text-[#64748B]/80">
          [MERKLE_LINEAGE: VERIFIED]
        </span>
      </div>

      <div className="flex items-center gap-4">
        {session.asked > 0 && (
          <span className="mono-label hidden items-center gap-3 text-[9.5px] text-[#64748B] lg:flex" aria-label={t('thisSession')}>
            <span><b className="text-[#1E293B]">{session.asked}</b> {t('asked')}</span>
            <span><b className="text-[#065F46]">{session.verified}</b> {t('verified')}</span>
            <span><b className="text-[#9F1239]">{session.refused}</b> {t('refused')}</span>
            <span><b className="text-[#1E293B]">{session.lastSec != null ? `${session.lastSec}s` : '—'}</b> {t('latency')}</span>
          </span>
        )}
        <span className="mono-label flex items-center gap-2 text-[9.5px] text-[#64748B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulseDot" />
          {t('indexedOfficialVerbatim')}
        </span>
      </div>
    </footer>
  );
}

/** Draggable divider between the two panes (pointer or arrow keys; double-click resets). Remembered per browser. */
const SPLIT_KEY = 'govresolve.split';
function useSplit() {
  const [ratio, setRatio] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(SPLIT_KEY));
      if (v >= 0.32 && v <= 0.68) return v;
    } catch { /* storage unavailable */ }
    return 0.5;
  });
  const update = useCallback((v) => {
    const c = Math.min(0.68, Math.max(0.32, v));
    setRatio(c);
    try { localStorage.setItem(SPLIT_KEY, String(c)); } catch { /* storage unavailable */ }
  }, []);
  return [ratio, update];
}

function SplitHandle({ ratio, onChange, containerRef }) {
  const { t } = useUiLanguage();
  const [drag, setDrag] = useState(false);
  const move = (x) => {
    const b = containerRef.current?.getBoundingClientRect();
    if (b) onChange((x - b.left - 16) / (b.width - 32));
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('resizePanes')}
      aria-valuemin={32}
      aria-valuemax={68}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      title={t('resizeHint')}
      className="group hidden cursor-col-resize touch-none select-none items-center justify-center lg:flex print:hidden"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); move(e.clientX); }}
      onPointerMove={(e) => drag && move(e.clientX)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      onDoubleClick={() => onChange(0.5)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(ratio - 0.03); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onChange(ratio + 0.03); }
      }}
    >
      <span className={`h-14 w-1 rounded-full transition-all group-hover:h-20 group-hover:bg-[#4F46E5] group-focus-visible:bg-[#4F46E5] ${drag ? 'h-24 bg-[#4F46E5]' : 'bg-[#E6E4DD]'}`} />
    </div>
  );
}

function AppContent() {
  const { t, setLanguage: setUiLanguage } = useUiLanguage();
  const [workspace, setWorkspace] = useState('ask');
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState(null); // null = auto detect
  const [asOf, setAsOf] = useState(''); // Rule Time Machine date filter
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [stages, setStages] = useState([]);   // live pipeline steps from POST /query/stream
  const [chatOpen, setChatOpen] = useState(false);
  const stageOn = useMemo(() => isStage(window.location.search), []);   // ?stage=1: pinned demo questions
  const stageCache = useRef({});
  const onStageCache = useCallback((c) => { stageCache.current = c; }, []);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // Active citation in Inquiry view
  const [libActive, setLibActive] = useState(null); // Active citation in Library view
  const [session, setSession] = useState({ asked: 0, verified: 0, refused: 0, lastSec: null });
  const [stage, setStage] = useState(() => (forceIntro() || !seenIntro() ? 'hero' : 'app')); // 'hero' | 'app'
  const [tour, setTour] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [chains, setChains] = useState({}); // lineage chains of other cited documents, fetched when selected
  const [keys, setKeys] = useState(false);
  const [focusAsk, setFocusAsk] = useState(0);
  const [ratio, setRatio] = useSplit();
  const mainRef = useRef(null);
  const abortRef = useRef(null);
  const typeTimer = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    fetchStats()
      .then((s) => {
        setStats(s);
        setOnline(true);
      })
      .catch(() => setOnline(false));
  }, []);

  // introduction -> application, with or without the tour
  const startTour = useCallback(() => {
    rememberIntro();
    setStage('app');
    setTimeout(() => setTour(true), 700);
  }, []);
  const skipIntro = useCallback(() => {
    rememberIntro();
    setStage('app');
  }, []);

  const closeTour = useCallback((finished) => {
    clearInterval(typeTimer.current);
    setTour(false);
    rememberTour();
    if (finished) {
      setWorkspace('ask');
      setFocusAsk((n) => n + 1);
    }
  }, []);

  const submit = async (text, fromSample = false, overrideLang = undefined) => {
    const q = text.trim();
    if (!q || loading) return;
    if (fromSample) setQuery(q);
    setWorkspace('ask');
    setLoading(true);
    setError(null);
    setResponse(null);
    setActive(null);
    setStages([]);
    const t0 = performance.now();
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const effectiveLang = overrideLang !== undefined ? overrideLang : language;
    try {
      const r = await ask(q, effectiveLang, ctl.signal, (ev) => {
        if (abortRef.current === ctl) setStages((st) => [...st, ev]);
      });
      const raw = (performance.now() - t0) / 1000;
      const sec = raw < 10 ? Math.max(0.1, Math.round(raw * 10) / 10) : Math.round(raw);
      setResponse(r);
      setOnline(true);
      setHistory((h) => [{ id: `${Date.now()}`, question: q, response: r, at: Date.now() }, ...h.filter((x) => x.question !== q)].slice(0, HISTORY_MAX));
      if (r.citations && r.citations[0]) {
        setActive(r.citations[0]);
      }
      setSession((s) => ({
        asked: s.asked + 1,
        verified: s.verified + (r.verdict === 'answered' && r.citations?.length ? 1 : 0),
        refused: s.refused + (r.verdict === 'answered' ? 0 : 1),
        lastSec: sec,
      }));
    } catch (e) {
      if (e?.name === 'AbortError') return; // cancelled by the user: back to the question, no error
      setError(e.message || 'The administrative inquiry could not be completed');
      if (/fetch|network/i.test(e.message || '')) setOnline(false);
    } finally {
      if (abortRef.current === ctl) setLoading(false);
    }
  };

  submitRef.current = submit;

  const cancel = () => abortRef.current?.abort();
  const openHistory = (h) => {
    abortRef.current?.abort();
    setWorkspace('ask');
    setLoading(false);
    setError(null);
    setQuery(h.question);
    setResponse(h.response);
    setActive(h.response.citations?.[0] || null);
  };
  const clearHistory = () => setHistory([]);
  // a pinned stage-mode question (?stage=1) or an answer opened from the chat helpline
  const openStagePin = (res, pin) => {
    if (!res) return;
    abortRef.current?.abort();
    setWorkspace('ask');
    setLoading(false);
    setError(null);
    setQuery(pin.question);
    setResponse(res);
    setActive(res.citations?.[0] || null);
  };
  const inspectFromChat = (q, res, cit) => {
    if (!res) return;
    openStagePin(res, { question: q });
    setChatOpen(false);
    const chosen = cit || res.citations?.[0] || null;
    setActive(chosen);
    if (res.verdict === 'answered' && !res.lineage_chain?.length && chosen?.gr_id) {
      lineageChain(chosen.gr_id)
        .then((c) => setResponse((cur) => (cur === res ? { ...res, lineage_chain: c } : cur)))
        .catch(() => {});
    }
  };

  // the tour asks one sample question for the visitor, typing it first
  const typeAndAsk = useCallback(() => {
    const text = SAMPLES[0].text;
    setWorkspace('ask');
    clearInterval(typeTimer.current);
    setQuery('');
    let n = 0;
    typeTimer.current = setInterval(() => {
      n += 3;
      setQuery(text.slice(0, n));
      if (n >= text.length) {
        clearInterval(typeTimer.current);
        submitRef.current?.(text, true);
      }
    }, 22);
  }, []);
  const focusQuestion = () => {
    setWorkspace('ask');
    setFocusAsk((n) => n + 1);
  };

  const landing = workspace === 'ask' && !loading && !response && !error;
  const chain = response?.lineage_chain || [];
  const firstId = response?.citations?.[0]?.gr_id;

  // Persist answered questions so saved chats can be reopened across browser sessions.
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // the lineage shown follows the selected citation: when an answer cites several resolutions, each has its own chain
  useEffect(() => { setChains({}); }, [response]);
  useEffect(() => {
    const id = active?.gr_id;
    if (!id || !response || id === firstId || chains[id] || chain.some((n) => n.gr_id === id)) return undefined;
    let live = true;
    lineageChain(id).then((c) => live && setChains((p) => ({ ...p, [id]: c }))).catch(() => {});
    return () => { live = false; };
  }, [active?.gr_id, response, firstId, chain, chains]);
  const ownChain = active?.gr_id && active.gr_id !== firstId ? chains[active.gr_id] : null;
  const shownChain = ownChain || chain;
  const shownFor = ownChain ? active : response?.citations?.[0];
  const asOfStatus = useMemo(() => {
    if (!asOf || !chain.length || !firstId) return null;
    const st = statusAsOf(chain, asOf)[firstId];
    return st ? (st.issued ? st.status : 'not_issued') : null;
  }, [asOf, chain, firstId]);

  const openNode = (n) => {
    const edge = (n.edges_out || [])[0];
    setActive({
      gr_id: n.gr_id,
      gr_number: n.gr_number,
      page: edge?.page || 1,
      issue_date: n.date,
      department: n.department,
      subject: n.subject,
      subject_en: n.subject_en,
      subject_gu: n.subject_gu,
      language: n.language,
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (tour || stage === 'hero') return;
      if (e.key === 'Escape') {
        setKeys(false);
        return;
      }
      if (typing(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        setWorkspace('ask');
        setFocusAsk((n) => n + 1);
      } else if (e.key === '?') {
        e.preventDefault();
        setTour(true);
      } else if (stageOn && ['1', '2', '3'].includes(e.key)) {
        const pin = STAGE_PINS[Number(e.key) - 1];
        const entry = pin && stageCache.current[pin.id];
        if (entry?.response) openStagePin(entry.response, pin);
      } else if (e.key === '1') {
        setWorkspace('ask');
      } else if (e.key === '2') {
        setWorkspace('library');
      } else if (e.key === '3') {
        setWorkspace('method');
      } else if ((e.key === ']' || e.key === '[') && response?.citations?.length) {
        const list = response.citations;
        const i = Math.max(0, list.findIndex((c) => citeKey(c) === citeKey(active)));
        setActive(list[(i + (e.key === ']' ? 1 : list.length - 1)) % list.length]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, stage, response, active, stageOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const split = workspace !== 'method' && !landing;
  const cols = { '--cols': `minmax(0, ${ratio}fr) 18px minmax(0, ${1 - ratio}fr)` };

  return (
    <>
    <AnimatePresence>
      {stage === 'hero' && (
        <motion.div key="intro" className="fixed inset-0 z-40 bg-canvas" initial={false} exit={{ opacity: 0, scale: 1.025, filter: 'blur(8px)' }} transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}>
          <LandingPage onGetStarted={startTour} onSkip={skipIntro} />
        </motion.div>
      )}
    </AnimatePresence>
    <div className="flex h-full flex-col font-sans" aria-hidden={stage === 'hero' ? true : undefined} inert={stage === 'hero' ? '' : undefined}>
      <TopBar
        stats={stats}
        online={online}
        language={language}
        onLanguage={(lang) => {
          setLanguage(lang);
          if (lang) setUiLanguage(lang);
          if (query && response && !loading) {
            submit(query, false, lang);
          }
        }}
        asOf={asOf}
        onAsOf={setAsOf}
        session={session}
        onCommand={focusQuestion}
        onHome={() => setStage('hero')}
      />
      {stageOn && <StageBar onOpen={openStagePin} onCache={onStageCache} />}

      <div className="flex min-h-0 flex-1">
        <Rail active={workspace} onChange={setWorkspace} onTour={() => setTour(true)} onShortcuts={() => setKeys(true)} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            ref={mainRef}
            key={workspace + (landing ? ':landing' : '')}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={split ? cols : undefined}
            className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 print:p-0 print:overflow-visible ${split ? 'grid grid-cols-1 content-start gap-4 lg:[grid-template-columns:var(--cols)] lg:gap-0 lg:overflow-hidden print:block' : ''}`}
          >
            {landing && (
              <section className="mx-auto w-full max-w-[1120px] px-1 pt-3 sm:pt-10" aria-label="Ask a question">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                  <div className="space-y-7">
                    <HeroHeader />
                    <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact={false} hero focusSignal={focusAsk} history={history} onOpenHistory={openHistory} onClearHistory={clearHistory} onOpenChat={() => setChatOpen(true)} />
                  </div>
                  <Specimen className="hidden lg:block" />
                </div>
                <Hero onAsk={(t) => submit(t, true)} disabled={loading} />
              </section>
            )}

            {workspace === 'ask' && !landing && (
              <>
                <section className="flex flex-col gap-3.5 lg:min-h-0 lg:overflow-y-auto lg:pr-1 print:overflow-visible print:block print:w-full" aria-label="Investigation">
                  <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact focusSignal={focusAsk} history={history} onOpenHistory={openHistory} onClearHistory={clearHistory} onOpenChat={() => setChatOpen(true)} />

                  <div data-tour="answer" className="space-y-3.5 print:space-y-4">
                    <AnimatePresence mode="wait">
                      {loading && <PipelineLoader key="loading" onCancel={cancel} live={stages} />}

                      {error && !loading && (
                        <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sheet flex gap-3.5 border border-[#FECDD3] border-l-[3px] border-l-[#F43F5E] bg-[#FFF1F2] p-4" role="alert">
                          <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-[#F43F5E]" />
                          <div className="min-w-0 flex-1">
                            <p className="display text-[15px] font-bold text-[#9F1239]">{t('inquiryCouldNotComplete')}</p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748B]">{error}</p>
                            {query.trim() && (
                              <button type="button" onClick={() => submit(query)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] px-2.5 py-1 text-[12px] font-semibold text-[#4F46E5] hover:text-[#4338CA] hover:bg-[#EEF2FF]" style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
                                <RotateCcw className="h-3 w-3" /> {t('tryAgain')}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {response && !loading && (
                        <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5 print:space-y-4 print:w-full">
                          {/* Secretariat Action Memo Print Header - Visible ONLY when printing */}
                          <div className="hidden print:block mb-6 border-b-2 border-stone-800 pb-3 text-left">
                            <div className="flex justify-between items-start">
                              <div>
                                <h1 className="text-xl font-extrabold tracking-tight text-black">GOVERNMENT OF GUJARAT</h1>
                                <h2 className="text-xs uppercase tracking-widest text-stone-600 font-mono mt-0.5">GovResolve-AI Administrative Action Memorandum (PS000230)</h2>
                              </div>
                              <div className="text-right text-[10px] text-stone-600 font-mono">
                                <p>DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                <p>STATUS: OFFICIAL VERIFIED EXTRACT</p>
                              </div>
                            </div>
                            <div className="mt-3 text-xs text-stone-800 bg-stone-100 p-2.5 rounded border border-stone-300">
                              <span className="font-bold text-black">INQUIRY SUBJECT: </span> {query}
                            </div>
                          </div>

                          <StatusBanner status={response.answer_status} reasonCode={response.reason_code} asOf={asOf} asOfStatus={asOfStatus} />
                          <WhatChanged citation={shownFor} chain={shownChain} onOpenNewer={(n) => { const node = shownChain.find((c) => c.gr_id === n.gr_id); if (node) openNode(node); }} />
                          <AnswerCard
                            response={response}
                            active={active}
                            onSelect={setActive}
                            language={language}
                            onLanguageChange={(newLang) => {
                              setLanguage(newLang);
                              setUiLanguage(newLang);
                              if (query && !loading) {
                                submit(query, false, newLang);
                              }
                            }}
                          />
                          <LineageGraph chain={shownChain} forGr={shownFor?.gr_number} asOf={asOf} onAsOf={setAsOf} activeId={active?.gr_id} onSelectNode={openNode} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                <SplitHandle ratio={ratio} onChange={setRatio} containerRef={mainRef} />

                <section data-tour="evidence" className="min-h-[30rem] lg:min-h-0 print:hidden" aria-label={t('evidence')}>
                  <PdfInspector citation={active} question={query} />
                </section>
              </>
            )}

            {workspace === 'library' && (
              <>
                <section data-tour="library" className="flex flex-col lg:min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Library">
                  <Library selectedId={libActive?.gr_id} onOpen={setLibActive} asOf={asOf} onAsOf={setAsOf} />
                </section>
                <SplitHandle ratio={ratio} onChange={setRatio} containerRef={mainRef} />
                <section className="min-h-[30rem] lg:min-h-0" aria-label={t('document')}>
                  <PdfInspector citation={libActive} question="" />
                </section>
              </>
            )}

            {workspace === 'method' && <Method stats={stats} />}
          </motion.main>
        </AnimatePresence>
      </div>

      <StatusBar onShortcuts={() => setKeys(true)} session={session} />
      <MobileTabs active={workspace} onChange={setWorkspace} />
      <Tour
        open={tour}
        onClose={closeTour}
        ctx={{
          hasAnswer: !!response,
          hasCitations: !!response?.citations?.length,
          hasLineage: shownChain.length > 0,
          loading,
          typeAndAsk,
          setWorkspace,
        }}
      />
      <ShortcutsDialog open={keys} onClose={() => setKeys(false)} />
      {stage !== 'hero' && <ChatHelpline open={chatOpen} onOpenChange={setChatOpen} onInspect={inspectFromChat} />}
    </div>
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LanguageBridge>
        <AppContent />
      </LanguageBridge>
    </LanguageProvider>
  );
}
