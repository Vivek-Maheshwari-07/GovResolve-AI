import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Rows3, Waypoints, ArrowUpRight, RotateCcw } from 'lucide-react';
import Seal from './Seal';
import { STATUS, TONES } from '../lib/status';
import { statusAsOf, issuedCount } from '../lib/lineage';

// Evolution map: orders sit left (oldest) to right (newest). Every link is an arc drawn from the NEWER order to the OLDER
// one it acts on, so the arrowhead lands on the order that was changed. Clicking a link opens the verbatim clause behind it.
const NODE_MAX = 184;
const NODE_MIN = 148;
const NODE_H = 138;
const PAD_X = 26;
const ARC_H = 132;

const REL_TONE = { supersedes: 'rose', replaces: 'rose', cancels: 'rose', amends: 'amber', refers_to: 'slate' };
const NODE_LABEL = { no_change: 'No later change', amended: 'Amended', superseded: 'Superseded' };
const SEAL_OF = { no_change: 'no_change', amended: 'amended', superseded: 'superseded' };

const dayBefore = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

function MapView({ chain, status, asOf, onAsOf, activeId, onSelectNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const trackRef = useRef(null);
  const [edgeId, setEdgeId] = useState(null);
  const [drag, setDrag] = useState(false);

  const n = chain.length;
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // cards shrink to fit the pane (down to NODE_MIN), then the map scrolls sideways
  const GAP = n > 2 ? 44 : 60;
  const NODE_W = Math.max(NODE_MIN, Math.min(NODE_MAX, Math.floor((wrapW - PAD_X * 2 - (n - 1) * GAP) / n)));
  const idx = useMemo(() => Object.fromEntries(chain.map((c, i) => [c.gr_id, i])), [chain]);
  const left = (i) => PAD_X + i * (NODE_W + GAP);
  const cx = (i) => left(i) + NODE_W / 2;
  const totalW = PAD_X * 2 + n * NODE_W + (n - 1) * GAP;
  const hasLinks = chain.some((c) => (c.edges_out || []).some((e) => idx[e.to_gr_id] != null && e.to_gr_id !== c.gr_id));
  const AH = hasLinks ? ARC_H : 6; // no links: no empty arc gallery
  const Y = AH - 1;

  const edges = useMemo(() => {
    const lanes = {};
    return chain.flatMap((node) =>
      (node.edges_out || [])
        .filter((e) => idx[e.to_gr_id] != null && e.to_gr_id !== node.gr_id)
        .map((e, k) => {
          const span = Math.abs(idx[node.gr_id] - idx[e.to_gr_id]);
          const lane = (lanes[span] = (lanes[span] ?? -1) + 1);
          const h = Math.min(AH - 22, 40 + span * 24) + lane * 12;
          const sx = cx(idx[node.gr_id]);
          const tx = cx(idx[e.to_gr_id]);
          const d = `M${sx} ${Y} C${sx} ${Y - h * 1.28}, ${tx} ${Y - h * 1.28}, ${tx} ${Y + 0}`;
          return { ...e, id: `${node.gr_id}>${e.to_gr_id}:${e.relation}:${k}`, from: node.gr_id, to: e.to_gr_id, d, mx: (sx + tx) / 2, my: Y - h * 0.96 };
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, idx]);

  const sel = edges.find((e) => e.id === edgeId) || null;
  const fromNode = sel ? chain[idx[sel.from]] : null;
  const toNode = sel ? chain[idx[sel.to]] : null;

  // ---- time scrubber: positions p = 0 (before the first order) .. m (today). Controlled by `asOf`.
  const stops = useMemo(() => chain.map((c, i) => ({ x: cx(i), date: c.date })).filter((s) => s.date), [chain]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = stops.length;
  const canScrub = !!onAsOf && m >= 2;
  const pOf = !asOf ? m : stops.filter((s) => s.date <= asOf).length;
  const xOfP = (p) => (p <= 0 ? stops[0].x - NODE_W / 2 : p >= m ? stops[m - 1].x + NODE_W / 2 : stops[p - 1].x);
  const dateOfP = (p) => (p >= m ? '' : p <= 0 ? dayBefore(stops[0].date) : stops[p - 1].date);
  const setP = (p) => onAsOf(dateOfP(Math.max(0, Math.min(m, p))));
  const fromPointer = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const px = clientX - r.left;
    setP(stops.filter((s) => s.x <= px).length);
  };

  return (
    <div>
      <div ref={wrapRef} className="overflow-x-auto pb-1">
        <div className="relative mx-auto" style={{ width: totalW, height: AH + NODE_H + (canScrub ? 62 : 8) }}>
          <svg className="absolute left-0 top-0" width={totalW} height={AH + 4} aria-hidden="true">
            <defs>
              {Object.entries(TONES).map(([k, t]) => (
                <marker key={k} id={`ah${uid}${k}`} viewBox="0 0 10 10" refX="5" refY="8" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M0 0 L10 0 L5 10 Z" fill={t.edge} />
                </marker>
              ))}
            </defs>
            {edges.map((e, i) => {
              const tone = REL_TONE[e.relation] || 'slate';
              const t = TONES[tone];
              const hot = e.id === edgeId || e.from === activeId || e.to === activeId;
              const issued = status[e.from]?.issued !== false;
              return (
                <motion.path
                  key={e.id}
                  d={e.d}
                  fill="none"
                  stroke={t.edge}
                  strokeWidth={hot ? 2.6 : 1.8}
                  strokeLinecap="round"
                  strokeDasharray={e.relation === 'refers_to' || e.warnings?.length ? '5 5' : undefined}
                  markerEnd={`url(#ah${uid}${tone})`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: issued ? (hot || (!edgeId && !activeId) ? 1 : 0.5) : 0.2 }}
                  transition={{ pathLength: { delay: 0.15 + i * 0.12, duration: 0.8, ease: 'easeOut' }, opacity: { duration: 0.2 } }}
                />
              );
            })}
          </svg>

          {/* relation pills sit on the arcs */}
          {edges.map((e) => {
            const t = TONES[REL_TONE[e.relation] || 'slate'];
            const on = e.id === edgeId;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEdgeId(on ? null : e.id)}
                aria-pressed={on}
                title={`${e.link_type} ${e.to_gr_number}: read the clause`}
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-all hover:scale-105 ${t.text}`}
                style={{
                  left: e.mx,
                  top: e.my,
                  background: on ? t.edge : t.wash,
                  color: on ? '#fff' : undefined,
                  boxShadow: `0 0 0 1px ${t.edge}${on ? '' : '66'}, 0 4px 10px -4px ${t.edge}88`,
                }}
              >
                {e.link_type}
              </button>
            );
          })}

          {/* order cards */}
          {chain.map((c, i) => {
            const st = status[c.gr_id] || { status: 'no_change', issued: true };
            const external = c.is_external;
            const selected = c.gr_id === activeId;
            const sealKey = external || !st.issued ? 'insufficient' : SEAL_OF[st.status] || 'no_change';
            const tone = TONES[(STATUS[sealKey] || STATUS.insufficient).tone];
            const first = (c.edges_out || []).find((e) => idx[e.to_gr_id] != null);
            return (
              <motion.button
                key={c.gr_id}
                type="button"
                disabled={external}
                onClick={() => onSelectNode(c)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: st.issued ? 1 : 0.42, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i, 10) * 0.05 }}
                aria-pressed={selected}
                className={`${external ? 'rounded-[16px] border border-dashed border-rule bg-sand/60' : 'sheet sheet-hover'} absolute p-3 text-left disabled:cursor-default`}
                style={{ left: left(i), top: AH, width: NODE_W, height: NODE_H, ...(selected ? { boxShadow: '0 0 0 2px #D98A1F, 0 14px 28px -12px rgba(217,138,31,.5)' } : null) }}
              >
                <div className="flex items-center gap-2">
                  <Seal status={sealKey} size={32} />
                  <p className={`mono-label min-w-0 text-[8.5px] leading-tight ${tone.text}`}>{external ? 'Not in corpus' : !st.issued ? 'Not yet issued' : NODE_LABEL[st.status] || 'No later change'}</p>
                </div>
                <p className="mt-2 truncate font-mono text-[12.5px] font-bold text-ink" title={c.gr_number}>{c.gr_number}</p>
                <p className="font-mono text-[11px] text-mist">{c.date || 'Undated'}</p>
                {c.subject && <p className="gu-text mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-legal">{c.subject}</p>}
                {first && !c.subject && <p className="mt-1 truncate text-[11px] text-mist">{first.link_type} {first.to_gr_number}</p>}
                {selected && <span className="mono-label absolute -top-2 right-3 rounded bg-[#D98A1F] px-1.5 py-0.5 text-[8.5px] text-white">Open</span>}
              </motion.button>
            );
          })}

          {/* time scrubber */}
          {canScrub && (
            <div className="absolute inset-x-0" style={{ top: AH + NODE_H + 8 }}>
              <div
                ref={trackRef}
                className="relative h-10 touch-none select-none"
                style={{ cursor: drag ? 'grabbing' : 'pointer' }}
                onPointerDown={(ev) => {
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  setDrag(true);
                  fromPointer(ev.clientX);
                }}
                onPointerMove={(ev) => drag && fromPointer(ev.clientX)}
                onPointerUp={() => setDrag(false)}
                onPointerCancel={() => setDrag(false)}
              >
                <div className="absolute inset-x-[26px] top-[18px] h-[5px] rounded-full bg-stone" style={{ boxShadow: 'inset 0 1px 1px rgba(30,41,59,.12)' }} />
                <motion.div className="absolute left-[26px] top-[18px] h-[5px] rounded-full bg-gradient-to-r from-iris-300 to-iris-600" animate={{ width: Math.max(0, xOfP(pOf) - 26) }} transition={drag ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }} />
                {stops.map((s) => (
                  <span key={s.x} aria-hidden className={`absolute top-[15px] h-[11px] w-[11px] -translate-x-1/2 rounded-full border-2 ${s.date <= (asOf || '9999') ? 'border-iris-600 bg-ivory' : 'border-rule bg-ivory'}`} style={{ left: s.x }} />
                ))}
                <motion.div
                  role="slider"
                  tabIndex={0}
                  aria-label="Rules as of date"
                  aria-valuemin={0}
                  aria-valuemax={m}
                  aria-valuenow={pOf}
                  aria-valuetext={asOf ? `As of ${asOf}` : 'Today'}
                  onKeyDown={(ev) => {
                    if (ev.key === 'ArrowLeft') { ev.preventDefault(); setP(pOf - 1); }
                    if (ev.key === 'ArrowRight') { ev.preventDefault(); setP(pOf + 1); }
                    if (ev.key === 'Home') { ev.preventDefault(); setP(0); }
                    if (ev.key === 'End') { ev.preventDefault(); setP(m); }
                  }}
                  className="absolute top-[9px] grid h-[24px] w-[24px] -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b from-white to-[#EEF0F8]"
                  style={{ boxShadow: '0 0 0 1.5px #4F46E5, 0 6px 14px -4px rgba(79,70,229,.55), inset 0 1px 0 #fff' }}
                  animate={{ left: xOfP(pOf), scale: drag ? 1.15 : 1 }}
                  transition={drag ? { left: { duration: 0 } } : { type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <span className="h-2 w-2 rounded-full bg-iris-600" />
                </motion.div>
                <motion.span
                  className="mono-label pointer-events-none absolute -top-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[9px] text-white"
                  animate={{ left: xOfP(pOf) }}
                  transition={drag ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
                >
                  {asOf ? `as of ${asOf}` : 'today'}
                </motion.span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* the clause behind a link */}
      <AnimatePresence mode="wait" initial={false}>
        {sel ? (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="well mt-3 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="mono-label text-mist">
                <span className="font-bold text-ink">{fromNode.gr_number}</span> <span className={TONES[REL_TONE[sel.relation] || 'slate'].text}>— {sel.link_type} →</span>{' '}
                <span className="font-bold text-ink">{toNode.gr_number}</span>
              </p>
              <button
                type="button"
                onClick={() => onSelectNode({ ...fromNode, edges_out: [sel, ...(fromNode.edges_out || []).filter((x) => x !== sel)] })}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-iris-600 hover:text-iris-800"
              >
                Open page {sel.page} <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            {sel.quote ? <p className="legal-text mt-2 border-l-[3px] border-gold-400 pl-3 text-[13px] text-ink">“{sel.quote}”</p> : <p className="mt-2 text-xs text-mist">No verbatim sentence was stored for this link.</p>}
            {sel.warnings?.length > 0 && (
              <p className="mt-2 text-[11.5px] font-medium text-[#8A4B0B]">⚠ {sel.warnings.join(' · ')} (drawn dashed)</p>
            )}
          </motion.div>
        ) : (
          edges.length === 0 ? (
            <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[12px] leading-relaxed text-mist">
              No amendment, supersession or cancellation links were found for this document in the indexed collection.
            </motion.p>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-[11.5px] text-faint">
              Select a link to read the exact clause that created it.{canScrub ? ' Drag the handle to see the chain on any date.' : ''}
            </motion.p>
          )
        )}
      </AnimatePresence>
    </div>
  );
}

function Ledger({ chain, onSelectNode }) {
  const byId = Object.fromEntries(chain.map((c) => [c.gr_id, c]));
  const rows = chain.flatMap((c) => (c.edges_out || []).map((e, k) => ({ c, e, k })));
  return (
    <ul className="ledger" aria-label="Lineage links">
      {rows.map(({ c, e, k }) => {
        const t = TONES[REL_TONE[e.relation] || 'slate'];
        return (
          <li key={`${c.gr_id}-${e.to_gr_id}-${k}`} className="py-2.5">
            <button type="button" onClick={() => onSelectNode({ ...c, edges_out: [e] })} className="group block w-full text-left">
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11.5px]">
                <span className="font-bold text-ink">{c.gr_number}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.text}`} style={{ background: t.wash, boxShadow: `0 0 0 1px ${t.edge}55` }}>{e.link_type}</span>
                <span className="font-bold text-ink">{byId[e.to_gr_id]?.gr_number || e.to_gr_number}</span>
                <span className="text-faint">{c.date} · p.{e.page}</span>
              </p>
              {e.quote && <p className="legal-text mt-1 line-clamp-2 text-[12.5px] text-mist group-hover:text-ink">“{e.quote}”</p>}
            </button>
          </li>
        );
      })}
      {rows.length === 0 && <li className="py-3 text-xs text-mist">No amendment links in this chain.</li>}
    </ul>
  );
}

export default function LineageGraph({ chain, asOf, onAsOf, activeId, onSelectNode }) {
  const [view, setView] = useState('map');
  const status = useMemo(() => statusAsOf(chain, asOf), [chain, asOf]);
  const counts = useMemo(() => issuedCount(chain, asOf), [chain, asOf]);

  if (!chain || !chain.length) return null;

  return (
    <section className="sheet p-4 sm:p-5" aria-label="Amendment lineage">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-iris-50 text-iris-700 ring-1 ring-iris-200">
            <GitBranch className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="display text-[17px] font-bold leading-tight text-ink">Amendment lineage</h2>
            <p className="mono-label mt-1 text-[9.5px] text-faint">{counts.total} {counts.total === 1 ? 'order' : 'orders'} · newer → older</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {asOf && (
            <button type="button" onClick={() => onAsOf?.('')} className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E3] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[#8A4B0B] ring-1 ring-[#F1D6A0] hover:bg-[#FCEBC8]" title="Back to today">
              as of {asOf} · {counts.issued}/{counts.total} issued <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <div className="well flex p-0.5" role="group" aria-label="Lineage view">
            {[['map', 'Map', Waypoints], ['ledger', 'Ledger', Rows3]].map(([k, label, Icon]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[11.5px] font-semibold transition ${view === k ? 'bg-ivory text-ink shadow-card' : 'text-mist hover:text-ink'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {view === 'map' ? <MapView chain={chain} status={status} asOf={asOf} onAsOf={onAsOf} activeId={activeId} onSelectNode={onSelectNode} /> : <Ledger chain={chain} onSelectNode={onSelectNode} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
