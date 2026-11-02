import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, LayoutGrid, Rows3, ArrowUpRight } from 'lucide-react';
import { STATUS, TONES } from '../lib/status';
import { statusAsOf, issuedCount } from '../lib/lineage';

const NODE_LABEL = { no_change: 'No later change', amended: 'Amended', superseded: 'Superseded' };

function Node({ n, st, selected, onSelect, index }) {
  const tone = TONES[STATUS[st.status].tone];
  const external = n.is_external;
  const acts = (n.edges_out || []).filter((e) => e.relation);
  return (
    <motion.button
      layout
      type="button"
      disabled={external}
      onClick={() => onSelect(n)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: st.issued ? 1 : 0.38, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: Math.min(index, 12) * 0.03 }}
      whileHover={external ? undefined : { y: -2 }}
      className={`relative z-10 w-[176px] shrink-0 rounded-xl border p-2.5 text-left transition-colors ${
        selected ? 'border-[rgba(245,158,11,0.6)] bg-[rgba(245,158,11,0.09)] shadow-[0_6px_18px_-8px_rgba(217,119,6,0.4)]' : external ? 'border-dashed border-[#D6D3CB] bg-sand/50' : 'border-hair bg-[rgba(255,255,255,0.92)] hover:border-[rgba(79,70,229,0.45)]'
      } ${external ? 'cursor-default' : ''}`}
      aria-pressed={selected}
    >
      <span className={`inline-flex items-center gap-1.5 rounded-full ${tone.pill} px-1.5 py-0.5 text-[10px] font-medium ${tone.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        {external ? 'Not in collection' : st.issued ? NODE_LABEL[st.status] : 'Not yet issued'}
      </span>
      <p className="mt-1.5 truncate font-mono text-[11.5px] text-legal" title={n.gr_number}>{n.gr_number}</p>
      <p className="font-mono text-[10.5px] text-mist">{n.date || 'undated'}</p>
      {acts.slice(0, 1).map((e) => (
        <p key={e.to_gr_id} className="mt-1.5 flex items-center gap-1 truncate text-[10.5px] text-iris-700" title={`${e.link_type} ${e.to_gr_number}`}>
          <ArrowUpRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{e.link_type} {e.to_gr_number}</span>
        </p>
      ))}
      {acts.length > 1 && <p className="text-[10px] text-[#8A94A6]">+{acts.length - 1} more</p>}
    </motion.button>
  );
}

export default function LineageGraph({ chain, asOf, activeId, onSelectNode }) {
  const [grid, setGrid] = useState(false);
  const status = useMemo(() => statusAsOf(chain, asOf), [chain, asOf]);
  const counts = useMemo(() => issuedCount(chain, asOf), [chain, asOf]);
  if (!chain.length) return null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-white p-4 shadow-lift" aria-label="Amendment lineage">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-violet-700">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-violet-100 text-violet-700"><GitBranch className="h-3.5 w-3.5" /></span> Amendment lineage · {counts.total} documents
        </h2>
        <div className="flex items-center gap-2">
          {asOf && <span className="rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.1)] px-2 py-0.5 font-mono text-[10.5px] text-[#92400E]">as of {asOf}: {counts.issued} of {counts.total} issued</span>}
          <button onClick={() => setGrid((g) => !g)} className="inline-flex items-center gap-1 rounded-md border border-hair px-2 py-1 text-[11px] text-mist transition hover:text-legal" aria-pressed={grid}>
            {grid ? <Rows3 className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />} {grid ? 'Timeline' : 'Show all'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-[#8A94A6]">Oldest on the left. Each arrow names the older order a document acts on, as stated in its own text. Click a document to open it.</p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={grid ? 'grid' : 'rail'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {grid ? (
            <div className="flex flex-wrap gap-2">
              {chain.map((n, i) => <Node key={n.gr_id} n={n} st={status[n.gr_id]} index={i} selected={n.gr_id === activeId} onSelect={onSelectNode} />)}
            </div>
          ) : (
            <div className="relative overflow-x-auto pb-2">
              <div className="absolute left-0 right-0 top-[26px] z-0 h-0.5 rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-teal-200" />
              <div className="relative flex w-max gap-2.5 pr-2">
                {chain.map((n, i) => <Node key={n.gr_id} n={n} st={status[n.gr_id]} index={i} selected={n.gr_id === activeId} onSelect={onSelectNode} />)}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
