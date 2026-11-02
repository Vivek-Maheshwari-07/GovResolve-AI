import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ServerCrash } from 'lucide-react';
import { ask, fetchStats } from './api';
import { statusAsOf } from './lib/lineage';
import TopBar from './components/TopBar';
import QueryDock from './components/QueryDock';
import PipelineLoader from './components/PipelineLoader';
import StatusBanner from './components/StatusBanner';
import AnswerCard from './components/AnswerCard';
import LineageGraph from './components/LineageGraph';
import PdfInspector from './components/PdfInspector';
import Hero from './components/Hero';

export default function App() {
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState(null);   // null = detect
  const [asOf, setAsOf] = useState('');             // Rule Time Machine date
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);       // what the evidence inspector shows

  useEffect(() => {
    fetchStats().then((s) => { setStats(s); setOnline(true); }).catch(() => setOnline(false));
  }, []);

  const submit = async (text, fromSample = false) => {
    const q = text.trim();
    if (!q || loading) return;
    if (fromSample) setQuery(q);
    setLoading(true); setError(null); setResponse(null); setActive(null);
    try {
      const r = await ask(q, language);
      setResponse(r);
      setOnline(true);
      if (r.citations[0]) setActive(r.citations[0]);
    } catch (e) {
      setError(e.message || 'The request failed');
      if (/fetch|network/i.test(e.message || '')) setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const chain = response?.lineage_chain || [];
  const firstId = response?.citations?.[0]?.gr_id;
  const asOfStatus = useMemo(() => (asOf && chain.length && firstId ? (() => { const st = statusAsOf(chain, asOf)[firstId]; return st ? (st.issued ? st.status : 'not_issued') : null; })() : null), [asOf, chain, firstId]);

  const openNode = (n) => {
    const edge = (n.edges_out || [])[0];
    setActive({ gr_id: n.gr_id, gr_number: n.gr_number, page: edge?.page || 1, issue_date: n.date, department: n.department, subject: n.subject, language: n.language });
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar stats={stats} online={online} language={language} onLanguage={setLanguage} asOf={asOf} onAsOf={setAsOf} />

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2 lg:overflow-hidden">
        {/* Zone B: investigation feed */}
        <section className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1" aria-label="Investigation">
          <QueryDock value={query} onChange={setQuery} onSubmit={submit} loading={loading} compact={!!(response || error || loading)} />

          <AnimatePresence mode="wait">
            {loading && <PipelineLoader key="loading" />}
            {error && !loading && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-[rgba(244,63,94,0.28)] bg-[rgba(244,63,94,0.1)] p-4" role="alert">
                <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-[#9F1239]" />
                <div>
                  <p className="text-sm font-semibold text-[#9F1239]">Could not get an answer</p>
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
        </section>

        {/* Zone C: evidence */}
        <section className="min-h-[34rem] lg:min-h-0" aria-label="Evidence">
          <PdfInspector citation={active} question={query} />
        </section>
      </main>
    </div>
  );
}
