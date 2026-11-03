import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, LayoutGrid, Rows3, ArrowLeft, ArrowUpRight, CheckCircle2, AlertTriangle, OctagonX, Clock } from 'lucide-react';
import { STATUS, TONES } from '../lib/status';
import { statusAsOf, issuedCount } from '../lib/lineage';

const NODE_LABEL = {
  no_change: 'No later change',
  amended: 'Amended',
  superseded: 'Superseded',
};

const ICONS = {
  no_change: CheckCircle2,
  amended: AlertTriangle,
  superseded: OctagonX,
};

function NodeCard({ n, st, selected, onSelect, index }) {
  const tone = TONES[STATUS[st.status]?.tone || 'slate'];
  const external = n.is_external;
  const acts = (n.edges_out || []).filter((e) => e.relation);
  const Icon = ICONS[st.status] || CheckCircle2;

  return (
    <motion.button
      layout
      type="button"
      disabled={external}
      onClick={() => onSelect(n)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: st.issued ? 1 : 0.4, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: Math.min(index, 12) * 0.03 }}
      whileHover={external ? undefined : { y: -2 }}
      className={`relative z-10 w-[190px] shrink-0 rounded-2xl border p-3 text-left transition-all ${
        selected
          ? 'border-amber-400 bg-amber-50/90 shadow-[0_6px_20px_-6px_rgba(217,119,6,0.35)] ring-1 ring-amber-300'
          : external
          ? 'border-dashed border-stone bg-sand/40 cursor-default'
          : 'glass-card hover:border-iris-400'
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-1 rounded-full ${tone.pill} border ${tone.ring} px-2 py-0.5 text-[10px] font-bold ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {external ? 'External' : st.issued ? NODE_LABEL[st.status] : 'Not yet issued'}
        </span>
        {!st.issued && (
          <span className="font-mono text-[9px] text-amber-700 font-semibold flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> future
          </span>
        )}
      </div>

      <p className="mt-2 truncate font-mono text-[12px] font-bold text-legal" title={n.gr_number}>
        {n.gr_number}
      </p>
      <p className="font-mono text-[11px] text-mist">{n.date || 'Undated'}</p>

      {/* Outgoing modification acts */}
      {acts.slice(0, 1).map((e) => (
        <div
          key={e.to_gr_id}
          className="mt-2 flex items-center gap-1 rounded-lg border border-iris-100 bg-iris-50/60 px-2 py-1 text-[10.5px] text-iris-800 font-medium truncate"
          title={`${e.link_type} ${e.to_gr_number}`}
        >
          <ArrowLeft className="h-3 w-3 shrink-0 text-iris-600" />
          <span className="truncate">{e.link_type} {e.to_gr_number}</span>
        </div>
      ))}
      {acts.length > 1 && (
        <p className="mt-1 text-[10px] font-mono text-mist">+{acts.length - 1} more older target orders</p>
      )}
    </motion.button>
  );
}

export default function LineageGraph({ chain, asOf, activeId, onSelectNode }) {
  const [grid, setGrid] = useState(false);
  const status = useMemo(() => statusAsOf(chain, asOf), [chain, asOf]);
  const counts = useMemo(() => issuedCount(chain, asOf), [chain, asOf]);

  if (!chain || !chain.length) return null;

  return (
    <section
      className="glass-card rounded-2xl border border-iris-100 bg-gradient-to-br from-iris-50/40 via-white to-white p-4 shadow-lift"
      aria-label="Amendment lineage"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hair/70 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-iris-100 text-iris-700 border border-iris-200">
            <GitBranch className="h-4 w-4" />
          </span>
          <div>
            <h2 className="eyebrow text-iris-800">
              Amendment Lineage · {counts.total} Orders in Chain
            </h2>
            <p className="text-[11px] text-mist">
              Oldest on left → Newer modifying orders on right (Newer acts on Older)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {asOf && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-amber-900 shadow-sm">
              As of {asOf}: {counts.issued} of {counts.total} issued
            </span>
          )}
          <button
            type="button"
            onClick={() => setGrid((g) => !g)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-white px-2.5 py-1 text-xs font-semibold text-mist shadow-sm transition hover:text-legal hover:border-iris-300"
            aria-pressed={grid}
          >
            {grid ? <Rows3 className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
            <span>{grid ? 'Timeline view' : 'Grid view'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={grid ? 'grid' : 'rail'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {grid ? (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {chain.map((n, i) => (
                <NodeCard
                  key={n.gr_id}
                  n={n}
                  st={status[n.gr_id] || { status: 'no_change', issued: true }}
                  index={i}
                  selected={n.gr_id === activeId}
                  onSelect={onSelectNode}
                />
              ))}
            </div>
          ) : (
            <div className="relative overflow-x-auto pb-3 pt-1">
              {/* Timeline Axis Line with Arrow indicator */}
              <div
                aria-hidden
                className="absolute left-4 right-4 top-[29px] z-0 h-1 rounded-full bg-gradient-to-r from-iris-300 via-indigo-300 to-iris-400 opacity-80"
              />
              <div className="relative flex w-max gap-3 pr-4">
                {chain.map((n, i) => (
                  <NodeCard
                    key={n.gr_id}
                    n={n}
                    st={status[n.gr_id] || { status: 'no_change', issued: true }}
                    index={i}
                    selected={n.gr_id === activeId}
                    onSelect={onSelectNode}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
