import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Seal from '../../components/Seal';
import { STATUS, TONES } from '../../lib/status';
import { statusAsOf } from '../../lib/lineage';

// Three invented orders. The statuses come from the same statusAsOf() the application uses, so what moves here is real logic.
const CHAIN = [
  { gr_id: 'A', gr_number: 'GR/EX/2014/001', date: '2014-03-12', edges_out: [] },
  { gr_id: 'B', gr_number: 'GR/EX/2018/045', date: '2018-05-20', edges_out: [{ to_gr_id: 'A', relation: 'amends', link_type: 'Amends' }] },
  { gr_id: 'C', gr_number: 'GR/EX/2021/130', date: '2021-08-02', edges_out: [{ to_gr_id: 'B', relation: 'supersedes', link_type: 'Supersedes' }] },
];
const START = Date.UTC(2013, 0, 1);
const DAY = 864e5;
const SPAN = Math.round((Date.UTC(2023, 0, 1) - START) / DAY);
const iso = (d) => new Date(START + d * DAY).toISOString().slice(0, 10);
const dayOf = (s) => Math.round((Date.parse(`${s}T00:00:00Z`) - START) / DAY);
const pretty = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const W = 760;
const PAD = 24;
const xOf = (d) => PAD + (d / SPAN) * (W - PAD * 2);
const TONE_KEY = { no_change: 'emerald', amended: 'amber', superseded: 'rose' };
const PRESETS = [['Mar 2016', '2016-03-01'], ['Jan 2020', '2020-01-15'], ['Dec 2022', '2022-12-01']];

export default function TimeDemo() {
  const [day, setDay] = useState(dayOf('2019-06-01'));
  const [focus, setFocus] = useState('B');
  const date = iso(day);
  const st = useMemo(() => statusAsOf(CHAIN, date), [date]);
  const mine = st[focus];
  const key = !mine.issued ? 'insufficient' : mine.status;
  const meta = STATUS[key];
  const tone = TONES[meta.tone];
  const chainNo = Object.fromEntries(CHAIN.map((c) => [c.gr_id, c.gr_number]));

  let headline = meta.headline;
  let note = meta.note;
  if (!mine.issued) {
    headline = 'This order did not exist yet';
    note = `${chainNo[focus]} is dated ${pretty(CHAIN.find((c) => c.gr_id === focus).date)}. On ${pretty(date)} an officer could not have found it.`;
  } else if (focus === 'A' && mine.status === 'amended' && st.B.status === 'superseded') {
    note = `Amended by ${chainNo.B}, but that amending order has itself been superseded by ${chainNo.C}. Read the successor before relying on either.`;
  } else if (focus === 'B' && mine.status === 'superseded') {
    note = `Replaced by ${chainNo.C} on ${pretty('2021-08-02')}. Do not act on this order; see its successor.`;
  } else if (mine.status === 'no_change') {
    note = 'No later amendment or replacement exists in the documents we hold. That is all this means: it does not prove the rule is in force.';
  }

  const ticks = [2013, 2015, 2017, 2019, 2021, 2023];

  return (
    <div className="sheet overflow-hidden rounded-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-5 py-3.5">
        <div>
          <p className="eyebrow">Try it · three invented orders</p>
          <p className="mt-0.5 text-[12.5px] text-mist">Pick the order you found, then drag the date. This is the same logic as the app’s Rule Time Machine.</p>
        </div>
        <div className="well flex p-0.5" role="group" aria-label="The order you found">
          {[['A', '2014 order'], ['B', '2018 order']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={focus === k} onClick={() => setFocus(k)} className={`rounded-[9px] px-3 py-1 text-[12px] font-semibold transition ${focus === k ? 'bg-ivory text-iris-800 shadow-card' : 'text-mist hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="border-b border-hair p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <svg viewBox={`0 0 ${W} 210`} className="w-full" role="img" aria-label="Timeline of three orders">
            <defs>
              <marker id="tdArrow" viewBox="0 0 10 10" refX="5" refY="8" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L10 0 L5 10 Z" fill="#8A93A4" />
              </marker>
            </defs>
            {/* axis */}
            <line x1={PAD} x2={W - PAD} y1="150" y2="150" stroke="#D6D2C5" strokeWidth="1.5" />
            {ticks.map((y) => {
              const x = xOf(dayOf(`${y}-01-01`));
              return (
                <g key={y}>
                  <line x1={x} x2={x} y1="146" y2="154" stroke="#B9B3A2" />
                  <text x={x} y="170" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#8A93A4">{y}</text>
                </g>
              );
            })}
            {/* links, drawn newer -> older */}
            {[['C', 'B', 'Supersedes', '#C2395A'], ['B', 'A', 'Amends', '#D98A1F']].map(([from, to, label, col]) => {
              const f = CHAIN.find((c) => c.gr_id === from);
              const t = CHAIN.find((c) => c.gr_id === to);
              const sx = xOf(dayOf(f.date));
              const tx = xOf(dayOf(t.date));
              const live = st[from].issued;
              const h = 78;
              return (
                <g key={from + to} opacity={live ? 1 : 0.22} style={{ transition: 'opacity .25s' }}>
                  <path d={`M${sx} 138 C${sx} ${138 - h}, ${tx} ${138 - h}, ${tx} 134`} fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" markerEnd="url(#tdArrow)" />
                  <text x={(sx + tx) / 2} y={140 - h * 0.74 - 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={col} fontFamily="Plus Jakarta Sans, sans-serif">{label}</text>
                </g>
              );
            })}
            {/* orders */}
            {CHAIN.map((c) => {
              const x = xOf(dayOf(c.date));
              const s = st[c.gr_id];
              const col = !s.issued ? '#C9C4B5' : TONES[TONE_KEY[s.status]].edge;
              const on = c.gr_id === focus;
              return (
                <g key={c.gr_id} style={{ cursor: c.gr_id === 'C' ? 'default' : 'pointer' }} onClick={() => c.gr_id !== 'C' && setFocus(c.gr_id)}>
                  {on && <circle cx={x} cy="150" r="13" fill="none" stroke="#4F46E5" strokeWidth="1.5" strokeDasharray="3 3" />}
                  <circle cx={x} cy="150" r="7" fill="#FDFCF9" stroke={col} strokeWidth="3" style={{ transition: 'stroke .25s' }} />
                  <text x={x} y="192" textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace" fill={s.issued ? '#1E293B' : '#A39E8E'}>{c.gr_number}</text>
                  <text x={x} y="204" textAnchor="middle" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fill="#8A93A4">{pretty(c.date)}</text>
                </g>
              );
            })}
            {/* playhead */}
            <g style={{ transform: `translateX(${xOf(day)}px)`, transition: 'none' }}>
              <line x1="0" x2="0" y1="30" y2="150" stroke="#4F46E5" strokeWidth="1.5" strokeDasharray="2 3" />
              <rect x="-38" y="8" width="76" height="20" rx="5" fill="#0F172A" />
              <text x="0" y="22" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="JetBrains Mono, monospace">{pretty(date)}</text>
            </g>
          </svg>

          <div style={{ paddingLeft: `${(PAD / W) * 100}%`, paddingRight: `${(PAD / W) * 100}%` }}>
            <input
              type="range"
              min="0"
              max={SPAN}
              step="7"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              aria-label="Date on which the officer reads the order"
              aria-valuetext={pretty(date)}
              className="time-range w-full"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11.5px] text-faint">Jump to</span>
            {PRESETS.map(([l, d]) => (
              <button key={l} type="button" onClick={() => setDay(dayOf(d))} className="rounded-full bg-ivory px-2.5 py-1 text-[11.5px] font-medium text-mist transition hover:text-iris-700" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.1), inset 0 1px 0 #fff' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col justify-center p-5 sm:p-6" style={{ background: `linear-gradient(160deg, ${tone.wash} 0%, transparent 70%)` }}>
          <p className="mono-label text-[9px] text-mist">On {pretty(date)}, an officer holding</p>
          <p className="mt-0.5 font-mono text-[12.5px] font-bold text-ink">{chainNo[focus]}</p>
          <div className="mt-4 flex items-center gap-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={key} initial={{ scale: 1.35, rotate: -16, opacity: 0 }} animate={{ scale: 1, rotate: -5, opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
                <Seal status={key} size={86} />
              </motion.div>
            </AnimatePresence>
            <div className="min-w-0">
              <span className={`rounded-full border ${tone.ring} bg-ivory/80 px-2 py-0.5 text-[10.5px] font-bold ${tone.text}`}>{!mine.issued ? 'Not yet issued' : meta.label}</span>
              <h3 className={`display mt-1.5 text-[17px] font-bold leading-tight ${tone.text}`}>{headline}</h3>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-mist">{note}</p>
        </div>
      </div>
    </div>
  );
}
