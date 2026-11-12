import React from 'react';
import { motion } from 'framer-motion';
import Seal from '../../components/Seal';
import { STATUS, TONES } from '../../lib/status';

export const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 170, damping: 24 } },
};

export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-12% 0px' }} transition={{ delay }}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, num }) {
  return (
    <p className="mono-label flex items-center gap-3 text-iris-700">
      {num && <span className="text-faint">{num}</span>}
      <span className="h-px w-8 bg-iris-600" />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ consequences */
const COSTS = [
  ['A penalty overturned', 'A department acts on a 2015 resolution. At the Civil Services Tribunal it turns out the resolution was amended in 2018, and the defence falls apart.'],
  ['An audit para', 'Allowances are paid under a legacy circular. The auditors flag them, and the money is recovered from clerks who followed the paper in front of them.'],
  ['A citizen turned away', 'A local desk applies a rule that no longer stands and asks for a certificate that is no longer required. A grievance petition follows, then an RTI.'],
];

export function Costs() {
  return (
    <ol className="mt-10 grid gap-x-10 gap-y-7 border-t border-hair pt-8 md:grid-cols-3">
      {COSTS.map(([t, b], i) => (
        <Reveal as="li" key={t} delay={i * 0.08}>
          <span className="font-mono text-[11px] font-bold text-faint">0{i + 1}</span>
          <h3 className="display mt-1 text-[17px] font-bold text-ink">{t}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-mist">{b}</p>
        </Reveal>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ how it works */
const Glyph = ({ children, tone = 'bg-ivory' }) => (
  <span className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[12px] font-semibold text-ink ${tone}`} style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.12), 0 1.5px 0 rgba(30,41,59,.1), inset 0 1px 0 #fff' }}>{children}</span>
);

const STEPS = [
  {
    n: '01',
    t: 'Ask in whatever language comes naturally',
    b: 'Gujarati, English, or Gujarati typed in Latin letters. The question is normalised against a glossary of administrative terms, and if it is not English it is also rendered in English so it can reach English resolutions.',
    visual: (
      <div className="space-y-2">
        <p className="gu-text flex items-start gap-2 text-[12.5px] text-ink"><Glyph>અ</Glyph><span>પ્રસૂતિ રજા માટે કયા documents જોઈએ?</span></p>
        <p className="flex items-start gap-2 text-[12.5px] text-ink"><Glyph>A</Glyph><span>Which documents are needed for maternity leave?</span></p>
        <p className="flex items-start gap-2 text-[12.5px] text-ink"><Glyph>અ/A</Glyph><span>Maternity leave mate kya documents joie?</span></p>
      </div>
    ),
  },
  {
    n: '02',
    t: 'Search scans and digital files together',
    b: 'Scanned Gujarati pages are read with OCR; digital PDFs are read directly. Keyword search and meaning-based search run side by side, and an exact GR number or date jumps straight to that document.',
    visual: (
      <div className="space-y-1.5 font-mono text-[11px] text-mist">
        <p className="flex justify-between border-b border-dashed border-stone pb-1"><span>OCR · guj + eng</span><span className="text-ink">scans</span></p>
        <p className="flex justify-between border-b border-dashed border-stone pb-1"><span>text layer</span><span className="text-ink">digital PDFs</span></p>
        <p className="flex justify-between border-b border-dashed border-stone pb-1"><span>BM25 + bge-m3</span><span className="text-ink">fused by rank</span></p>
        <p className="flex justify-between"><span>GR no. / date</span><span className="text-ink">exact hit first</span></p>
      </div>
    ),
  },
  {
    n: '03',
    t: 'Prove it on the page',
    b: 'The model chooses which numbered sentences support its answer. The application copies those sentences from the page, so a quote can never be reworded. The paragraph is then highlighted on the original PDF.',
    visual: (
      <div className="legal-text text-[11.5px] leading-[1.7] text-[#3A4356]">
        …shall be submitted{' '}
        <span className="rounded-[2px] px-0.5 text-ink" style={{ background: 'rgba(245,184,61,.55)' }}>with the leave application</span>.
        <p className="mono-label mt-2 text-[8.5px] text-[#B45309]">GR/EX/2018/045 · p.2 · 20 May 2018</p>
      </div>
    ),
  },
  {
    n: '04',
    t: 'Trace what happened next',
    b: 'Explicit words such as “in supersession of” or “further to amend” create a link from the newer order to the older one. Each answer is checked against those links, and the chain is drawn so you can read the clause behind every arrow.',
    visual: (
      <svg viewBox="0 0 220 70" className="w-full" aria-hidden>
        <path d="M168 46 C168 6, 110 6, 110 44" fill="none" stroke="#C2395A" strokeWidth="1.6" />
        <path d="M110 46 C110 8, 52 8, 52 44" fill="none" stroke="#D98A1F" strokeWidth="1.6" />
        {[52, 110, 168].map((x, i) => (<circle key={x} cx={x} cy="50" r="5" fill="#FDFCF9" stroke={['#D98A1F', '#C2395A', '#4F8A74'][i]} strokeWidth="2.6" />))}
        <text x="52" y="68" fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fill="#556075">2014</text>
        <text x="110" y="68" fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fill="#556075">2018</text>
        <text x="168" y="68" fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fill="#556075">2021</text>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <div className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.07} className="flex flex-col border-t-2 border-ink pt-4">
          <span className="display text-[38px] font-bold italic leading-none text-iris-600">{s.n}</span>
          <h3 className="display mt-3 text-[16.5px] font-bold leading-snug text-ink">{s.t}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-mist">{s.b}</p>
          <div className="well mt-4 flex-1 p-3.5">{s.visual}</div>
        </Reveal>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ limits */
const PROMISES = [
  ['It never says a rule is in force.', '“No later change found” only describes the documents we hold. Absence of an amendment is not proof of validity.'],
  ['It does not retype quotes.', 'A quote is copied from the stored page text, with its page number and the box of its paragraph.'],
  ['It refuses, with a reason.', 'Not in the collection, too vague, outside what resolutions can answer, a broken amendment chain, or a poor scan.'],
  ['It gives no legal advice.', 'Questions asking for an opinion on what someone should do are declined and explained.'],
];

// From data/eval/SCORECARD_SUMMARY.md (local qwen3.5:4b; dev 50 questions, held-out 16). Small sets, not officer-validated.
const HONEST = [
  ['100%', 'quotes found verbatim on their page'],
  ['20 / 20', 'unanswerable questions refused with the right code'],
  ['55–69%', 'of answerable questions fully correct'],
  ['≈ 45 s', 'median answer time on a laptop CPU'],
];

export function Limits() {
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <ul className="space-y-5">
        {PROMISES.map(([t, b], i) => (
          <Reveal as="li" key={t} delay={i * 0.06} className="grid grid-cols-[1.6rem_1fr] gap-3">
            <span className="display text-[17px] font-bold italic text-iris-600">{['i', 'ii', 'iii', 'iv'][i]}.</span>
            <div>
              <p className="text-[14.5px] font-bold text-ink">{t}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-mist">{b}</p>
            </div>
          </Reveal>
        ))}
      </ul>

      <Reveal className="space-y-6">
        <div>
          <p className="eyebrow">Every finding carries one seal</p>
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5">
            {Object.values(STATUS).map((s) => (
              <div key={s.key} className="flex flex-col items-start gap-2">
                <Seal status={s.key} size={58} />
                <p className={`text-[11px] font-bold leading-tight ${TONES[s.tone].text}`}>{s.label}</p>
                {s.reserved && <p className="mono-label text-[8px] text-faint">reserved</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-hair bg-ivory/70 p-4">
          <p className="eyebrow">Where it is today, honestly</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3.5">
            {HONEST.map(([n, l]) => (
              <div key={l}>
                <dt className="font-mono text-[20px] font-bold tabular-nums text-ink">{n}</dt>
                <dd className="text-[11.5px] leading-snug text-mist">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-hair pt-2.5 text-[11px] leading-relaxed text-faint">Our own tests: 50 development and 16 held-out questions on a local 4B model. The question sets were drafted by us and are not yet validated by officers. The full scorecard is in the Method workspace.</p>
        </div>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ audience */
const WHO = [
  ['Officers', 'Finding the operative rule', 'Which documents are required for this type of leave?', 'en'],
  ['Establishment branches', 'Checking before processing', 'By how much was the upper age limit relaxed for direct selection in 2022?', 'en'],
  ['Citizens', 'Asking in their own words', 'પ્રસૂતિ રજા માટે કયા documents જોઈએ?', 'gu'],
];

export function ForWhom() {
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-3">
      {WHO.map(([who, what, q, lang], i) => (
        <Reveal key={who} delay={i * 0.08} className="sheet flex flex-col p-5">
          <p className="eyebrow">{who}</p>
          <p className="display mt-1 text-[15px] font-bold text-ink">{what}</p>
          <blockquote className={`mt-4 flex-1 border-l-[3px] border-gold-400 pl-3 text-[14px] leading-relaxed text-ink ${lang === 'gu' ? 'gu-text' : 'legal-text'}`}>“{q}”</blockquote>
        </Reveal>
      ))}
    </div>
  );
}
