import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Library as LibraryIcon, Loader2, ArrowUpDown, Filter, BookOpen } from 'lucide-react';
import { listGrs, lineageChain } from '../api';
import { STATUS, TONES } from '../lib/status';
import LineageGraph from './LineageGraph';

const UNKNOWN = { label: 'Status unknown', tone: 'slate' };

const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'amended', label: 'Amended' },
  { id: 'superseded', label: 'Superseded' },
  { id: 'no_change', label: 'No later change' },
];

const LANG_FILTERS = [
  { id: 'all', label: 'All Languages' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'en', label: 'English' },
];

const MAX_ROWS = 150;

const norm = (s) => String(s || '').toLowerCase().replace(/[\s/._-]+/g, '');

function FilterPill({ on, onClick, children, gu }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all shadow-sm ${
        on
          ? 'border-iris-300 bg-iris-50 text-iris-800 ring-1 ring-iris-200'
          : 'border-hair bg-white text-mist hover:text-legal hover:border-stone'
      } ${gu ? 'gu-text' : ''}`}
    >
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
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  useEffect(() => {
    listGrs().then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setChain([]);
      return;
    }
    lineageChain(selectedId).then(setChain).catch(() => setChain([]));
  }, [selectedId]);

  const counts = useMemo(() => {
    const c = { all: 0, amended: 0, superseded: 0, no_change: 0 };
    (rows || []).forEach((r) => {
      c.all += 1;
      if (c[r.status] !== undefined) c[r.status] += 1;
    });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const nq = norm(q);
    let filtered = rows.filter(
      (r) =>
        (lang === 'all' || r.language === lang) &&
        (status === 'all' || r.status === status) &&
        (!nq ||
          norm(r.gr_number).includes(nq) ||
          norm(r.subject).includes(nq) ||
          String(r.issue_date || '').includes(q.trim()))
    );

    if (sortOrder === 'oldest') {
      filtered = [...filtered].reverse();
    }
    return filtered;
  }, [rows, q, lang, status, sortOrder]);

  const open = (r) =>
    onOpen({
      gr_id: r.gr_id,
      gr_number: r.gr_number,
      page: 1,
      issue_date: r.issue_date,
      department: r.department,
      subject: r.subject,
      language: r.language,
    });

  const openNode = (n) =>
    onOpen({
      gr_id: n.gr_id,
      gr_number: n.gr_number,
      page: (n.edges_out || [])[0]?.page || 1,
      issue_date: n.date,
      department: n.department,
      subject: n.subject,
      language: n.language,
    });

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Header */}
      <header className="space-y-1 px-1">
        <div className="flex items-center gap-2">
          <span className="eyebrow text-iris-800">
            ● Executive Corpus Library · {counts.all} Indexed Resolutions
          </span>
        </div>
        <h2 className="display text-[24px] font-bold text-legal">Official Resolution Repository</h2>
        <p className="text-[12.5px] text-mist">
          Search the indexed collection by GR number, subject, or year. Inspect any document to view its verified contents and amendment ancestry.
        </p>
      </header>

      {/* Search & Filter Toolbar */}
      <div className="glass-card space-y-2.5 rounded-2xl p-3 shadow-lift">
        <label className="flex items-center gap-2.5 rounded-xl border border-hair bg-white px-3 py-2 focus-within:border-iris-400 focus-within:ring-2 focus-within:ring-iris-100 transition-all shadow-sm">
          <Search className="h-4 w-4 text-iris-600 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by GR Number, keyword or year (e.g. CRR, રજા, 2022)…"
            aria-label="Search the library"
            className="gu-text flex-1 bg-transparent text-[13.5px] text-legal outline-none placeholder:text-[#8A94A6]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-xs font-mono text-mist hover:text-legal"
            >
              Clear
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-hair/60">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANG_FILTERS.map((f) => (
              <FilterPill key={f.id} on={lang === f.id} onClick={() => setLang(f.id)} gu={f.id === 'gu'}>
                {f.label}
              </FilterPill>
            ))}
            <span className="mx-1 h-3 w-px bg-hair" />
            {STATUS_FILTERS.map((f) => (
              <FilterPill key={f.id} on={status === f.id} onClick={() => setStatus(f.id)}>
                {f.label} <span className="font-mono opacity-60">({counts[f.id]})</span>
              </FilterPill>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1 rounded-lg border border-hair bg-white px-2.5 py-1 text-[11px] font-semibold text-mist hover:text-legal shadow-sm"
          >
            <ArrowUpDown className="h-3 w-3" />
            <span>Sort: {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}</span>
          </button>
        </div>
      </div>

      {/* Selected Document Lineage Preview if Available */}
      {selectedId && chain.length > 1 && (
        <LineageGraph chain={chain} asOf={asOf} activeId={selectedId} onSelectNode={openNode} />
      )}

      {/* Documents List */}
      <div className="glass-card min-h-[16rem] flex-1 overflow-hidden rounded-2xl shadow-lift flex flex-col">
        {!rows && !error && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-mist">
            <Loader2 className="h-4 w-4 animate-spin text-iris-600" />
            <span>Loading indexed resolutions…</span>
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">
            Could not retrieve resolution index: {error}
          </div>
        )}

        {rows && (
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-hair/70" aria-label="Resolutions">
              {shown.slice(0, MAX_ROWS).map((r, i) => {
                const s = STATUS[r.status] || UNKNOWN;
                const t = TONES[s.tone];
                const on = r.gr_id === selectedId;

                return (
                  <motion.li
                    key={r.gr_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 20) * 0.01 }}
                  >
                    <button
                      type="button"
                      onClick={() => open(r)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        on ? 'bg-iris-50/90 ring-1 ring-iris-200' : 'hover:bg-sand/60'
                      }`}
                      aria-pressed={on}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.dot}`} title={s.label} />

                      <div className="min-w-0 flex-1">
                        <p className="gu-text line-clamp-1 text-[13.5px] font-semibold text-legal">
                          {r.subject || r.gr_number}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-mist">
                          <span className="font-semibold text-legal">{r.gr_number}</span>
                          <span>· {r.issue_date || 'Undated'}</span>
                          <span>· {r.department || 'General Administration'}</span>
                          <span className="rounded bg-sand px-1.5 py-0.2 font-semibold">
                            {r.language === 'gu' ? 'ગુજરાતી' : r.language === 'en' ? 'EN' : r.language}
                          </span>
                        </div>
                      </div>

                      {r.status !== 'no_change' && (
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${t.ring} ${t.pill} ${t.text}`}
                        >
                          {s.label === UNKNOWN.label ? 'Unknown' : s.label.replace('Found + ', '')}
                        </span>
                      )}
                    </button>
                  </motion.li>
                );
              })}

              {shown.length === 0 && (
                <li className="p-8 text-center text-sm text-mist">
                  No matching Government Resolutions found. Try searching by GR number (e.g. CRR) or keyword.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-mist">
        <LibraryIcon className="h-3 w-3 text-iris-700" />
        <span>Lineage status is strictly derived from explicit amendment, supersession, or cancellation references.</span>
      </p>
    </div>
  );
}
