import React, { useEffect, useState } from 'react';

/** Number that counts up once when it first has a value. Honours prefers-reduced-motion. */
export default function CountUp({ value, duration = 900, format = (n) => n.toLocaleString() }) {
  const target = Number(value);
  const valid = value != null && Number.isFinite(target);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!valid) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setN(target);
      return undefined;
    }
    let raf;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, valid, duration]);

  return <>{valid ? format(n) : '—'}</>;
}
