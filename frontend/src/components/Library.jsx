import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Library as LibraryIcon, Loader2 } from 'lucide-react';
import { listGrs, lineageChain } from '../api';
import { STATUS, TONES } from '../lib/status';
import LineageGraph from './LineageGraph';

const UNKNOWN = { label: 'Status unknown', tone: 'slate' };
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'amended', label: 'Amended' },
  { id: 'superseded', label: 'Superseded' },
  { id: 'no_change', label: 'No later change' },
];
const LANG_FILTERS = [
  { id: 'all', label: 'All languages' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'en', label: 'English' },
];
const MAX_ROWS = 120; // keep the list light; the search narrows it

const norm = (s) => String(s || '').toLowerCase().replace(/[\s/._-]+/g, '');

function Chip({ on, onClick, children, gu }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-hair bg-white text-mist hover:text-legal'} ${gu ? 'gu-text' : ''}`}>
      {children}
    </button>
  );
}

export default function Library({ selectedId, onOpen, asOf }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('all');
  const [status, setStatus] = useState('all');
  const [chain, setChain] = useState([]);

  useEffect(() => { listGrs().then(setRows).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!selectedId) { setChain([]); return; }
    lineageChain(selectedId).then(setChain).catch(() => setChain([]));
  }, [selectedId]);

  const counts = useMemo(() => {
    const c = { all: 0, amended: 0, superseded: 0, no_change: 0 };
    (rows || []).forEach((r) => { c.all += 1; if (c[r.status] !== undefined) c[r.status] += 1; });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const nq = norm(q);
    return rows.filter((r) =>
      (lang === 'all' || r.language === lang)
      && (status === 'all' || r.status === status)
      && (!nq || norm(r.gr_number).includes(nq) || norm(r.subject).includes(nq) || String(r.issue_date || '').includes(q.trim())));
  }, [rows, q, lang, status]);

  const open = (r) => onOpen({ gr_id: r.gr_id, gr_number: r.gr_number, page: 1, issue_date: r.issue_date, department: r.department, subject: r.subject, language: r.language });
  const openNode = (n) => onOpen({ gr_id: n.gr_id, gr_number: n.gr_number, page: (n.edges_out || [])[0]?.page || 1, issue_date: n.date, department: n.department, subject: n.subject, language: n.language });

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <header className="space-y-1 px-1">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-teal-700">● Library · {counts.all} GRs</p>
        <h2 className="text-[22px] font-bold tracking-tight text-legal">Browse every resolution</h2>
        <p className="text-[12.5px] text-mist">Search by GR number, subject or date. Open one to read it and see what amends it.</p>
      </header>

      <div className="glass space-y-2.5 rounded-2xl p-3">
        <label className="flex items-center gap-2 rounded-xl border border-hair bg-white px-3 py-2 focus-within:border-teal-300 focus-within:ring-2 focus-within:ring-teal-100">
          <Search className="h-4 w-4 text-teal-600" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="GR number, subject or year — e.g. CRR, રજા, 2022" aria-label="Search the library" className="gu-text flex-1 bg-transparent text-[14px] text-legal outline-none placeholder:text-[#8A94A6]" />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {LANG_FILTERS.map((f) => <Chip key={f.id} on={lang === f.id} onClick={() => setLang(f.id)} gu={f.id === 'gu'}>{f.label}</Chip>)}
          <span className="mx-1 h-3 w-px bg-stone" />
          {STATUS_FILTERS.map((f) => <Chip key={f.id} on={status === f.id} onClick={() => setStatus(f.id)}>{f.label} <span className="font-mono opacity-60">{counts[f.id]}</span></Chip>)}
        </div>
      </div>

      {selectedId && chain.length > 1 && <LineageGraph chain={chain} asOf={asOf} activeId={selectedId} onSelectNode={openNode} />}

      <div className="glass min-h-[16rem] flex-1 overflow-hidden rounded-2xl">
        {!rows && !error && <div className="flex items-center gap-2 p-4 text-sm text-mist"><Loader2 className="h-4 w-4 animate-spin" /> Loading the library…</div>}
        {error && <p className="p-4 text-sm text-rose-700">Could not load the library: {error}</p>}
        {rows && (
          <ul className="max-h-full divide-y divide-[#EEECE6] overflow-y-auto" aria-label="Resolutions">
            {shown.slice(0, MAX_ROWS).map((r, i) => {
              const s = STATUS[r.status] || UNKNOWN;
              const t = TONES[s.tone];
              const on = r.gr_id === selectedId;
              return (
                <motion.li key={r.gr_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.01 }}>
                  <button onClick={() => open(r)} className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-teal-50/80' : 'hover:bg-sand/60'}`} aria-pressed={on}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.dot}`} title={s.label} />
                    <span className="min-w-0 flex-1">
                      <span className="gu-text line-clamp-1 text-[13px] font-medium text-legal">{r.subject || r.gr_number}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10.5px] text-mist">
                        <span className="truncate">{r.gr_number}</span>
                        <span>{r.issue_date || 'undated'}</span>
                        <span>{r.language === 'gu' ? 'ગુ' : r.language === 'en' ? 'EN' : r.language}</span>
                      </span>
                    </span>
                    {r.status !== 'no_change' && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.ring} ${t.pill} ${t.text}`}>{s.label === UNKNOWN.label ? 'Unknown' : s.label.replace('Found + ', '')}</span>}
                  </button>
                </motion.li>
              );
            })}
            {shown.length === 0 && <li className="p-4 text-sm text-mist">Nothing matches. Try a GR number, a word from the subject, or a year.</li>}
            {shown.length > MAX_ROWS && <li className="p-3 text-center font-mono text-[11px] text-mist">{shown.length - MAX_ROWS} more: narrow the search to see them</li>}
          </ul>
        )}
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-mist"><LibraryIcon className="h-3 w-3" /> Status comes only from explicit amend / replace / cancel references in the documents.</p>
    </div>
  );
}
