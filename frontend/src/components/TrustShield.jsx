import React from 'react';
import { Check, Minus } from 'lucide-react';

// The "Trust Shield" from the brief: a plain account of what stands behind an answer, computed only from the response itself.
function Row({ ok = true, children, sub }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${ok ? 'bg-[#065F46] text-white' : 'bg-[#E6E4DD] text-[#64748B]'}`}>
        {ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <Minus className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 text-[12px] leading-snug text-[#1E293B]">
        <b className="font-semibold text-[#1E293B]">{children}</b>
        {sub && <span className="block text-[11px] text-[#64748B]">{sub}</span>}
      </span>
    </li>
  );
}

function ShieldMark() {
  return (
    <svg viewBox="0 0 40 46" className="h-11 w-10 shrink-0" aria-hidden>
      <path d="M20 2 L36 8 V22 C36 33 29 40 20 44 C11 40 4 33 4 22 V8 Z" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M20 8 L31 12 V22 C31 30 26 35 20 38 C14 35 9 30 9 22 V12 Z" fill="none" stroke="#10B981" strokeOpacity=".45" strokeWidth="1" strokeDasharray="1.5 2.5" />
      <path d="M13.5 23 L18.5 28 L27 17.5" fill="none" stroke="#065F46" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TrustShield({ response }) {
  const answered = response.verdict === 'answered';
  const cits = response.citations || [];

  if (!answered) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E6E4DD] bg-[#F1EFEA]/60 px-3.5 py-3" aria-label="Trust Shield">
        <svg viewBox="0 0 40 46" className="h-10 w-9 shrink-0" aria-hidden>
          <path d="M20 2 L36 8 V22 C36 33 29 40 20 44 C11 40 4 33 4 22 V8 Z" fill="#FFF1F2" stroke="#F43F5E" strokeWidth="1.8" strokeDasharray="4 3" strokeLinejoin="round" />
          <text x="20" y="29" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="Merriweather, serif" fill="#9F1239">?</text>
        </svg>
        <div>
          <p className="eyebrow text-[#64748B]">Trust Shield</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#1E293B]"><b className="text-[#1E293B]">Nothing was guessed.</b> No passage met the evidence bar, so no answer was written and no quote was shown.</p>
        </div>
      </div>
    );
  }

  const docs = new Set(cits.map((c) => c.gr_id)).size;
  const dates = cits.map((c) => c.issue_date).filter(Boolean).sort();
  const st = response.statements || [];
  const est = st.filter((s) => s.label === 'Established').length;
  const inf = st.filter((s) => s.label === 'Inferred').length;
  const sup = cits.filter((c) => c.lineage?.status === 'superseded').length;
  const amd = cits.filter((c) => c.lineage?.status === 'amended').length;
  const unk = cits.filter((c) => c.lineage?.status === 'unknown').length;
  const span = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`) : null;

  return (
    <div className="mt-4 flex items-start gap-3.5 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-3" aria-label="Trust Shield">
      <ShieldMark />
      <div className="min-w-0 flex-1">
        <p className="eyebrow !text-[#065F46]">Trust Shield</p>
        <ul className="mt-1.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
          <Row ok={cits.length > 0} sub="copied from the source page, with page and date">{cits.length} verbatim {cits.length === 1 ? 'quote' : 'quotes'}</Row>
          <Row ok={docs > 0} sub={span ? `issued ${span}` : null}>{docs} {docs === 1 ? 'resolution' : 'resolutions'} cited</Row>
          <Row ok={unk === 0} sub={sup || amd ? `${sup} superseded · ${amd} amended: read the warning` : unk ? `${unk} could not be placed in a chain` : 'no later amendment found in the collection'}>Lineage checked for each source</Row>
          {st.length > 0 && <Row ok={inf === 0} sub={inf ? 'inferred statements are reasoned, not stated in the text' : 'every statement is stated in a cited passage'}>{est} established · {inf} inferred</Row>}
        </ul>
      </div>
    </div>
  );
}
