import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ServerCrash, X } from 'lucide-react';
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
import Hero from './components/Hero';
import Library from './components/Library';
import Method from './components/Method';
import Tour from './components/Tour';

const TOUR_KEY = 'govresolve.tour.seen';
const SHORTCUTS = [
  ['/', 'Ask a question'],
  ['1  2  3', 'Ask · Library · Method'],
  ['[  ]', 'Previous / next citation'],
  ['?', 'Guided tour'],
  ['Esc', 'Close this panel'],
];

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

function seenTour() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}
function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode: the tour simply shows again */ }
}

function ShortcutsDialog({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.35)] p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-hair bg-white p-5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-legal">Keyboard shortcuts</h3>
              <button onClick={onClose} aria-label="Close" className="text-mist hover:text-legal"><X className="h-4 w-4" /></button>
            </div>
            <ul className="space-y-2">
              {SHORTCUTS.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between text-[13px] text-legal">
                  <span>{v}</span>
                  <kbd className="rounded-md border border-hair bg-sand px-2 py-0.5 font-mono text-[11.5px] text-legal shadow-[0_1px_0_#E6E4DD]">{k}</kbd>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusBar({ onShortcuts }) {
  return (
    <footer className="hidden items-center justify-between gap-4 border-t border-hair bg-white/70 px-4 py-1.5 text-[11px] text-mist backdrop-blur-md md:flex">
      <button onClick={onShortcuts} className="flex items-center gap-3 hover:text-legal">
        {[['/', 'ask'], ['1 2 3', 'workspaces'], ['[ ]', 'citations'], ['?', 'tour']].map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><kbd className="rounded border border-hair bg-sand px-1.5 font-mono text-[10.5px] text-legal">{k}</kbd>{v}</span>
        ))}
      </button>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Answers only from indexed GRs · every quote checked verbatim
      </span>
    </footer>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState('ask');
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState(null);   // null = detect
  const [asOf, setAsOf] = useState('');             // Rule Time Machine date
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);       // what the evidence inspector shows in Ask
  const [libActive, setLibActive] = useState(null); // ... and in Library
  const [session, setSession] = useState({ asked: 0, verified: 0, refused: 0, lastSec: null });
  const [tour, setTour] = useState(false);
  const [keys, setKeys] = useState(false);
  const [focusAsk, setFocusAsk] = useState(0);   // bumped by the '/' shortcut

  useEffect(() => {
    fetchStats().then((s) => { setStats(s); setOnline(true); }).catch(() => setOnline(false));
    if (!seenTour()) setTimeout(() => setTour(true), 700);
  }, []);

  const closeTour = useCallback(() => { setTour(false); rememberTour(); }, []);

  const submit = async (text, fromSample = false) => {
    const q = text.trim();
    if (!q || loading) return;
    if (fromSample) setQuery(q);
    setWorkspace('ask');
    setLoading(true); setError(null); setResponse(null); setActive(null);
    const t0 = performance.now();
    try {
      const r = await ask(q, language);
      const sec = Math.round((performance.now() - t0) / 1000);
      setResponse(r);
      setOnline(true);
      if (r.citations[0]) setActive(r.citations[0]);
      setSession((s) => ({
        asked: s.asked + 1,
        verified: s.verified + (r.verdict === 'answered' && r.citations.length ? 1 : 0),
        refused: s.refused + (r.verdict === 'answered' ? 0 : 1),
        lastSec: sec,
      }));
    } catch (e) {
      setError(e.message || 'The request failed');
      if (/fetch|network/i.test(e.message || '')) setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const chain = response?.lineage_chain || [];
  const firstId = response?.citations?.[0]?.gr_id;
  const asOfStatus = useMemo(() => {
    if (!asOf || !chain.length || !firstId) return null;
    const st = statusAsOf(chain, asOf)[firstId];
    return st ? (st.issued ? st.status : 'not_issued') : null;
  }, [asOf, chain, firstId]);

  const openNode = (n) => {
    const edge = (n.edges_out || [])[0];
    setActive({ gr_id: n.gr_id, gr_number: n.gr_number, page: edge?.page || 1, issue_date: n.date, department: n.department, subject: n.subject, language: n.language });
  };

  // keyboard: / ask, 1-3 workspaces, [ ] citations, ? tour
  useEffect(() => {
    const onKey = (e) => {
      if (tour) return;
      if (e.key === 'Escape') { setKeys(false); return; }
      if (typing(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setWorkspace('ask'); setFocusAsk((n) => n + 1); }
      else if (e.key === '?') { e.preventDefault(); setTour(true); }
      else if (e.key === '1') setWorkspace('ask');
      else if (e.key === '2') setWorkspace('library');
      else if (e.key === '3') setWorkspace('method');
      else if ((e.key === ']' || e.key === '[') && response?.citations?.length) {
        const list = response.citations;
        const i = Math.max(0, list.findIndex((c) => citeKey(c) === citeKey(active)));
        setActive(list[(i + (e.key === ']' ? 1 : list.length - 1)) % list.length]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, response, active]);

  return (
    <div className="flex h-full flex-col">
      <TopBar stats={stats} online={online} language={language} onLanguage={setLanguage} asOf={asOf} onAsOf={setAsOf} session={session} />

      <div className="flex min-h-0 flex-1">
        <Rail active={workspace} onChange={setWorkspace} onTour={() => setTour(true)} onShortcuts={() => setKeys(true)} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={workspace}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className={`min-h-0 flex-1 overflow-y-auto p-4 ${workspace === 'method' ? '' : 'grid grid-cols-1 gap-4 lg:grid-cols-2 lg:overflow-hidden'}`}
          >
            {workspace === 'ask' && (
              <>
                <section className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1" aria-label="Investigation">
                  <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact={!!(response || error || loading)} focusSignal={focusAsk} />
                  <div data-tour="answer" className="space-y-3">
                    <AnimatePresence mode="wait">
                      {loading && <PipelineLoader key="loading" />}
                      {error && !loading && (
                        <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                          <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                          <div>
                            <p className="text-sm font-semibold text-rose-800">Could not get an answer</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-mist">{error}</p>
                          </div>
                        </motion.div>
                      )}
                      {response && !loading && (
                        <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <StatusBanner status={response.answer_status} reasonCode={response.reason_code} asOf={asOf} asOfStatus={asOfStatus} />
                          <AnswerCard response={response} active={active} onSelect={setActive} />
                          <LineageGraph chain={chain} asOf={asOf} activeId={active?.gr_id} onSelectNode={openNode} />
                        </motion.div>
                      )}
                      {!loading && !response && !error && (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Hero onAsk={(t) => submit(t, true)} disabled={loading} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>
                <section data-tour="evidence" className="min-h-[34rem] lg:min-h-0" aria-label="Evidence">
                  <PdfInspector citation={active} question={query} />
                </section>
              </>
            )}

            {workspace === 'library' && (
              <>
                <section className="flex min-h-0 flex-col lg:overflow-y-auto lg:pr-1" aria-label="Library">
                  <Library selectedId={libActive?.gr_id} onOpen={setLibActive} asOf={asOf} />
                </section>
                <section className="min-h-[34rem] lg:min-h-0" aria-label="Document">
                  <PdfInspector citation={libActive} question="" />
                </section>
              </>
            )}

            {workspace === 'method' && <Method stats={stats} />}
          </motion.main>
        </AnimatePresence>
      </div>

      <StatusBar onShortcuts={() => setKeys(true)} />
      <MobileTabs active={workspace} onChange={setWorkspace} />
      <Tour open={tour} onClose={closeTour} />
      <ShortcutsDialog open={keys} onClose={() => setKeys(false)} />
    </div>
  );
}
