import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ServerCrash, X, RotateCcw } from 'lucide-react';
import { ask, fetchStats } from './api';
import { statusAsOf } from './lib/lineage';
import { citeKey } from './components/AnswerCard';
import TopBar from './components/TopBar';
import Rail, { MobileTabs } from './components/Rail';
import QueryDock from './components/QueryDock';
import PipelineLoader from './components/PipelineLoader';
import StatusBanner from './components/StatusBanner';
import AnswerCard from './components/AnswerCard';
import LineageGraph from './components/LineageGraph';
import PdfInspector from './components/PdfInspector';
import Hero, { HeroHeader, Specimen } from './components/Hero';
import Library from './components/Library';
import Method from './components/Method';
import Tour from './components/Tour';

const TOUR_KEY = 'govresolve.tour.seen';
const SHORTCUTS = [
  ['/', 'Focus inquiry input'],
  ['1  2  3', 'Inquiry · Library · Method'],
  ['[  ]', 'Previous / next verified citation'],
  ['?', 'Interactive guided tour'],
  ['Esc', 'Close the open dialog'],
];

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

function seenTour() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}
function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode fallback */ }
}

function ShortcutsDialog({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(30,41,59,0.4)] p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="sheet w-full max-w-sm p-5 shadow-float"
          >
            <div className="mb-3 flex items-center justify-between border-b border-hair pb-3">
              <h3 className="display text-[17px] font-bold text-ink">Keyboard shortcuts</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-mist hover:bg-sand hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2.5">
              {SHORTCUTS.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between text-[13px] text-legal">
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
  return (
    <footer className="hidden items-center justify-between gap-4 border-t border-hair bg-canvas/70 px-4 py-1.5 backdrop-blur-md md:flex">
      <button onClick={onShortcuts} className="flex items-center gap-3 text-[11px] text-mist transition-colors hover:text-ink">
        {[['/', 'inquire'], ['1 2 3', 'workspaces'], ['[ ]', 'citations'], ['?', 'tour']].map(([k, v]) => (
          <span key={v} className="flex items-center gap-1.5">
            <span className="flex gap-0.5">{k.split(' ').map((x) => <kbd key={x} className="kbd !h-[18px] !min-w-[18px] !text-[9.5px]">{x}</kbd>)}</span>
            <span>{v}</span>
          </span>
        ))}
      </button>
      {session.asked > 0 && (
        <span className="mono-label hidden items-center gap-3 text-[9.5px] text-mist lg:flex" aria-label="This session">
          <span><b className="text-ink">{session.asked}</b> asked</span>
          <span><b className="text-[#2F5D4E]">{session.verified}</b> verified</span>
          <span><b className="text-[#8E1F3A]">{session.refused}</b> refused</span>
          <span><b className="text-ink">{session.lastSec != null ? `${session.lastSec}s` : '—'}</b> last</span>
        </span>
      )}
      <span className="mono-label flex items-center gap-2 text-[9.5px] text-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-[#4F8A74] animate-pulseDot" />
        Answers come only from indexed official resolutions, quoted verbatim
      </span>
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
  const [drag, setDrag] = useState(false);
  const move = (x) => {
    const b = containerRef.current?.getBoundingClientRect();
    if (b) onChange((x - b.left - 16) / (b.width - 32));
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      aria-valuemin={32}
      aria-valuemax={68}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      className="group hidden cursor-col-resize touch-none select-none items-center justify-center lg:flex"
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
      <span className={`h-14 w-1 rounded-full transition-all group-hover:h-20 group-hover:bg-iris-500 group-focus-visible:bg-iris-500 ${drag ? 'h-24 bg-iris-600' : 'bg-rule'}`} />
    </div>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState('ask');
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState(null); // null = auto detect
  const [asOf, setAsOf] = useState(''); // Rule Time Machine date filter
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // Active citation in Inquiry view
  const [libActive, setLibActive] = useState(null); // Active citation in Library view
  const [session, setSession] = useState({ asked: 0, verified: 0, refused: 0, lastSec: null });
  const [tour, setTour] = useState(false);
  const [keys, setKeys] = useState(false);
  const [focusAsk, setFocusAsk] = useState(0);
  const [ratio, setRatio] = useSplit();
  const mainRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetchStats()
      .then((s) => {
        setStats(s);
        setOnline(true);
      })
      .catch(() => setOnline(false));

    if (!seenTour()) {
      const timer = setTimeout(() => setTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeTour = useCallback(() => {
    setTour(false);
    rememberTour();
  }, []);

  const submit = async (text, fromSample = false) => {
    const q = text.trim();
    if (!q || loading) return;
    if (fromSample) setQuery(q);
    setWorkspace('ask');
    setLoading(true);
    setError(null);
    setResponse(null);
    setActive(null);
    const t0 = performance.now();
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const r = await ask(q, language, ctl.signal);
      const sec = Math.round((performance.now() - t0) / 1000);
      setResponse(r);
      setOnline(true);
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

  const cancel = () => abortRef.current?.abort();
  const focusQuestion = () => {
    setWorkspace('ask');
    setFocusAsk((n) => n + 1);
  };

  const landing = workspace === 'ask' && !loading && !response && !error;
  const chain = response?.lineage_chain || [];
  const firstId = response?.citations?.[0]?.gr_id;
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
      language: n.language,
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (tour) return;
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
  }, [tour, response, active]);

  const split = workspace !== 'method' && !landing;
  const cols = { '--cols': `minmax(0, ${ratio}fr) 18px minmax(0, ${1 - ratio}fr)` };

  return (
    <div className="flex h-full flex-col font-sans">
      <TopBar
        stats={stats}
        online={online}
        language={language}
        onLanguage={setLanguage}
        asOf={asOf}
        onAsOf={setAsOf}
        session={session}
        onCommand={focusQuestion}
      />

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
            className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 ${split ? 'grid grid-cols-1 content-start gap-4 lg:[grid-template-columns:var(--cols)] lg:gap-0 lg:overflow-hidden' : ''}`}
          >
            {landing && (
              <section className="mx-auto w-full max-w-[1120px] px-1 pt-3 sm:pt-10" aria-label="Ask a question">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                  <div className="space-y-7">
                    <HeroHeader />
                    <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact={false} hero focusSignal={focusAsk} />
                  </div>
                  <Specimen className="hidden lg:block" />
                </div>
                <Hero onAsk={(t) => submit(t, true)} disabled={loading} />
              </section>
            )}

            {workspace === 'ask' && !landing && (
              <>
                <section className="flex flex-col gap-3.5 lg:min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Investigation">
                  <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact focusSignal={focusAsk} />

                  <div data-tour="answer" className="space-y-3.5">
                    <AnimatePresence mode="wait">
                      {loading && <PipelineLoader key="loading" onCancel={cancel} />}

                      {error && !loading && (
                        <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sheet flex gap-3.5 border-l-[3px] border-l-[#C2395A] p-4" role="alert">
                          <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-[#C2395A]" />
                          <div className="min-w-0 flex-1">
                            <p className="display text-[15px] font-bold text-[#8E1F3A]">The inquiry could not be completed</p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-mist">{error}</p>
                            {query.trim() && (
                              <button type="button" onClick={() => submit(query)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-ivory px-2.5 py-1 text-[12px] font-semibold text-iris-700 hover:text-iris-800" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.12), inset 0 1px 0 #fff' }}>
                                <RotateCcw className="h-3 w-3" /> Try again
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {response && !loading && (
                        <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5">
                          <StatusBanner status={response.answer_status} reasonCode={response.reason_code} asOf={asOf} asOfStatus={asOfStatus} />
                          <AnswerCard response={response} active={active} onSelect={setActive} />
                          <LineageGraph chain={chain} asOf={asOf} onAsOf={setAsOf} activeId={active?.gr_id} onSelectNode={openNode} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                <SplitHandle ratio={ratio} onChange={setRatio} containerRef={mainRef} />

                <section data-tour="evidence" className="min-h-[30rem] lg:min-h-0" aria-label="Evidence">
                  <PdfInspector citation={active} question={query} />
                </section>
              </>
            )}

            {workspace === 'library' && (
              <>
                <section className="flex flex-col lg:min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Library">
                  <Library selectedId={libActive?.gr_id} onOpen={setLibActive} asOf={asOf} onAsOf={setAsOf} />
                </section>
                <SplitHandle ratio={ratio} onChange={setRatio} containerRef={mainRef} />
                <section className="min-h-[30rem] lg:min-h-0" aria-label="Document">
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
      <Tour open={tour} onClose={closeTour} />
      <ShortcutsDialog open={keys} onClose={() => setKeys(false)} />
    </div>
  );
}
