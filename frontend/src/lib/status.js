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

// Semantic 5-status taxonomy (pastel pills):
// 1. Found + No later change: bg #ECFDF5, border #A7F3D0, text #065F46, dot #10B981
// 2. Found + Amended / Conflict: bg #FFFBEB, border #FDE68A, text #92400E, dot #F59E0B
// 3. Found + Superseded / Insufficient Evidence: bg #FFF1F2, border #FECDD3, text #9F1239, dot #F43F5E
//
// fg / wash / edge are raw hex for SVG (seals, lineage arcs). Class strings are literal so Tailwind can see them.
export const TONES = {
  emerald: { text: 'text-[#065F46]', dot: 'bg-[#10B981]', pill: 'bg-[#ECFDF5]', ring: 'border-[#A7F3D0]', iconRing: 'ring-[#A7F3D0]', glow: '', fg: '#065F46', wash: '#ECFDF5', edge: '#10B981' },
  amber: { text: 'text-[#92400E]', dot: 'bg-[#F59E0B]', pill: 'bg-[#FFFBEB]', ring: 'border-[#FDE68A]', iconRing: 'ring-[#FDE68A]', glow: '', fg: '#92400E', wash: '#FFFBEB', edge: '#F59E0B' },
  rose: { text: 'text-[#9F1239]', dot: 'bg-[#F43F5E]', pill: 'bg-[#FFF1F2]', ring: 'border-[#FECDD3]', iconRing: 'ring-[#FECDD3]', glow: '', fg: '#9F1239', wash: '#FFF1F2', edge: '#F43F5E' },
  plum: { text: 'text-[#92400E]', dot: 'bg-[#F59E0B]', pill: 'bg-[#FFFBEB]', ring: 'border-[#FDE68A]', iconRing: 'ring-[#FDE68A]', glow: '', fg: '#92400E', wash: '#FFFBEB', edge: '#F59E0B' },
  slate: { text: 'text-[#9F1239]', dot: 'bg-[#F43F5E]', pill: 'bg-[#FFF1F2]', ring: 'border-[#FECDD3]', iconRing: 'ring-[#FECDD3]', glow: '', fg: '#9F1239', wash: '#FFF1F2', edge: '#F43F5E' },
  iris: { text: 'text-[#4338CA]', dot: 'bg-[#4F46E5]', pill: 'bg-[#EEF2FF]', ring: 'border-[#C7D2FE]', iconRing: 'ring-[#C7D2FE]', glow: '', fg: '#4F46E5', wash: '#EEF2FF', edge: '#4F46E5' },
};

export const toneOf = (statusKey) => TONES[(STATUS[statusKey] || STATUS.insufficient).tone];
