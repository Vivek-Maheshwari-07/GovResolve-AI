import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { STATUS, toneOf } from '../lib/status';

// Verdict seal: every status has its own stamp (ring text, glyph, jewel tone). Large seals "stamp" in once with a spring.
const RING = {
  no_change: 'NO LATER CHANGE FOUND · INDEXED COLLECTION ONLY · ',
  amended: 'AMENDMENT ON RECORD · READ WITH THE ORIGINAL · ',
  superseded: 'SUPERSEDED · DO NOT ACT ON THIS ORDER · ',
  conflict: 'CONFLICTING ORDERS · RESOLVE BEFORE RELYING · ',
  insufficient: 'INSUFFICIENT EVIDENCE · NO ANSWER GIVEN · ',
};

function Glyph({ status, fg }) {
  const p = { fill: 'none', stroke: fg, strokeWidth: 3.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (status) {
    case 'no_change':
      return <path {...p} d="M37.5 51.5 L46.5 60.5 L63.5 40.5" />;
    case 'amended':
      return (
        <g>
          <path {...p} d="M50 35.5 L65 63 H35 Z" />
          <path {...p} strokeWidth={3} d="M50 46 V54" />
          <circle cx="50" cy="58.6" r="1.7" fill={fg} />
        </g>
      );
    case 'superseded':
      return <path {...p} d="M39 39 L61 61 M61 39 L39 61" />;
    case 'conflict':
      return <path {...p} strokeWidth={3.2} d="M36 45 H63 M55 37.5 L63 45 L55 52.5 M64 56 H37 M45 48.5 L37 56 L45 63.5" />;
    default:
      return (
        <text x="50" y="61" textAnchor="middle" fontSize="32" fontWeight="700" fontFamily="Merriweather, Georgia, serif" fill={fg}>
          ?
        </text>
      );
  }
}

export default function Seal({ status = 'insufficient', size = 64, stamped = false, className = '', delay = 0 }) {
  const key = STATUS[status] ? status : 'insufficient';
  const t = toneOf(key);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const compact = size < 46;
  const dashed = key === 'insufficient';

  const svg = (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false" className="block overflow-visible">
      <defs>
        <path id={`ring${uid}`} d="M50,50 m-37.5,0 a37.5,37.5 0 1,1 75,0 a37.5,37.5 0 1,1 -75,0" />
        <radialGradient id={`wash${uid}`} cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor={t.wash} />
        </radialGradient>
      </defs>
      {/* disc + soft drop */}
      <circle cx="50" cy="52" r="46" fill="rgba(30,41,59,0.10)" filter="blur(3px)" />
      <circle cx="50" cy="50" r="47" fill={`url(#wash${uid})`} stroke={t.edge} strokeWidth={compact ? 3.4 : 1.6} strokeDasharray={dashed && !compact ? '4 3' : undefined} />
      {!compact && (
        <>
          <circle cx="50" cy="50" r="49.2" fill="none" stroke={t.edge} strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="0.6 2.6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="29" fill="none" stroke={t.edge} strokeOpacity="0.7" strokeWidth="1" strokeDasharray={dashed ? '2.5 2.5' : undefined} />
          <text fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="6.3" fontWeight="700" fill={t.fg} letterSpacing="0.4">
            <textPath href={`#ring${uid}`} textLength="233" lengthAdjust="spacing">
              {RING[key]}
            </textPath>
          </text>
        </>
      )}
      <g transform={compact ? 'translate(50 50) scale(1.55) translate(-50 -50)' : undefined}>
        <Glyph status={key} fg={t.fg} />
      </g>
    </svg>
  );

  if (!stamped) return <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>{svg}</span>;

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: t.edge }}
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
        transition={{ duration: 0.8, delay: delay + 0.12, ease: 'easeOut' }}
      />
      <motion.span
        className="block"
        initial={{ scale: 1.7, opacity: 0, rotate: -22 }}
        animate={{ scale: 1, opacity: 1, rotate: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 17, mass: 0.8, delay }}
      >
        {svg}
      </motion.span>
    </span>
  );
}
