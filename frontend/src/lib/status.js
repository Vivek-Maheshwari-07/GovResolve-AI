// The status taxonomy shown to the user. There is deliberately no "active" / "safe" status: finding no later order
// in the indexed documents does not prove a rule is in force (hard rule of the project).
// "Conflict" (contradictory orders) is not produced by the backend yet: it is designed (seal, tone) and marked `reserved`
// so the legend says so honestly and no data is ever labelled with it.
export const STATUS = {
  no_change: {
    key: 'no_change',
    label: 'Found + No later change',
    short: 'No later change',
    headline: 'No later change found',
    note: 'Checked only against the indexed documents. This does not prove the rule is still in force: look for newer orders.',
    tone: 'emerald',
  },
  amended: {
    key: 'amended',
    label: 'Found + Amended',
    short: 'Amended',
    headline: 'Caution: an amendment was found',
    note: 'Read the amending order together with the original. The lineage below shows which orders change it.',
    tone: 'amber',
  },
  superseded: {
    key: 'superseded',
    label: 'Found + Superseded',
    short: 'Superseded',
    headline: 'Do not act: order superseded',
    note: 'A later order replaces a cited document. See its successor in the lineage.',
    tone: 'rose',
  },
  conflict: {
    key: 'conflict',
    label: 'Conflict',
    short: 'Conflict',
    headline: 'Orders contradict each other',
    note: 'Two orders in the collection say different things. Resolve the conflict before relying on either.',
    tone: 'plum',
    reserved: true,
  },
  insufficient: {
    key: 'insufficient',
    label: 'Insufficient evidence',
    short: 'Insufficient evidence',
    headline: 'The documents cannot establish an answer',
    note: 'The system refuses rather than guess.',
    tone: 'slate',
  },
};

export const REASONS = {
  NO_DOCUMENT: 'Not in the collection',
  TOO_VAGUE: 'Question too vague',
  OUT_OF_SCOPE: 'Outside what GRs can answer',
  MISSING_FACTS: 'Facts missing',
  BROKEN_CHAIN: 'Broken amendment chain',
  POOR_SCAN: 'Poor scan',
};

// Jewel pastels: wash (background), ring (border), text (deep jewel), dot (mid jewel).
// fg / wash / edge are raw hex for SVG (seals, lineage arcs). Class strings are literal so Tailwind can see them.
export const TONES = {
  emerald: { text: 'text-[#2F5D4E]', dot: 'bg-[#4F8A74]', pill: 'bg-[#EEF5F1]', ring: 'border-[#C5DDD1]', iconRing: 'ring-[#C5DDD1]', glow: '', fg: '#2F5D4E', wash: '#EEF5F1', edge: '#4F8A74' },
  amber: { text: 'text-[#8A4B0B]', dot: 'bg-[#D98A1F]', pill: 'bg-[#FFF6E3]', ring: 'border-[#F1D6A0]', iconRing: 'ring-[#F1D6A0]', glow: '', fg: '#8A4B0B', wash: '#FFF6E3', edge: '#D98A1F' },
  rose: { text: 'text-[#8E1F3A]', dot: 'bg-[#C2395A]', pill: 'bg-[#FDF0F3]', ring: 'border-[#F0C4CF]', iconRing: 'ring-[#F0C4CF]', glow: '', fg: '#8E1F3A', wash: '#FDF0F3', edge: '#C2395A' },
  plum: { text: 'text-[#6B2A7A]', dot: 'bg-[#9B4DB0]', pill: 'bg-[#F8F1FB]', ring: 'border-[#E1C8E9]', iconRing: 'ring-[#E1C8E9]', glow: '', fg: '#6B2A7A', wash: '#F8F1FB', edge: '#9B4DB0' },
  slate: { text: 'text-[#475569]', dot: 'bg-[#94A3B8]', pill: 'bg-sand', ring: 'border-stone', iconRing: 'ring-stone', glow: '', fg: '#475569', wash: '#F1EFEA', edge: '#94A3B8' },
  iris: { text: 'text-iris-700', dot: 'bg-iris-500', pill: 'bg-iris-50', ring: 'border-iris-200', iconRing: 'ring-iris-200', glow: '', fg: '#4338CA', wash: '#EEF2FF', edge: '#6366F1' },
};

export const toneOf = (statusKey) => TONES[(STATUS[statusKey] || STATUS.insufficient).tone];
