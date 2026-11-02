// The status taxonomy shown to the user. There is deliberately no "active" / "safe" status: finding no later order
// in the indexed documents does not prove a rule is in force (hard rule of the project).
// "Conflict" (contradictory orders) is not produced by the backend, so it is not offered here.
export const STATUS = {
  no_change: {
    key: 'no_change',
    label: 'Found + No later change',
    headline: 'No later change found',
    note: 'Checked only against the indexed documents. This does not prove the rule is still in force: look for newer orders.',
    tone: 'emerald',
  },
  amended: {
    key: 'amended',
    label: 'Found + Amended',
    headline: 'Caution: an amendment was found',
    note: 'Read the amending order together with the original. The lineage below shows which orders change it.',
    tone: 'amber',
  },
  superseded: {
    key: 'superseded',
    label: 'Found + Superseded',
    headline: 'Do not act: order superseded',
    note: 'A later order replaces a cited document. See its successor in the lineage.',
    tone: 'rose',
  },
  insufficient: {
    key: 'insufficient',
    label: 'Insufficient evidence',
    headline: 'The documents cannot establish an answer',
    note: 'The system refuses rather than guess.',
    tone: 'rose',
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

// Soft pastel pill + deep jewel type (spec values): bg / border / text / dot
export const TONES = {
  emerald: { text: 'text-[#065F46]', dot: 'bg-[#10B981]', pill: 'bg-[#ECFDF5]', ring: 'border-[#A7F3D0]', iconRing: 'ring-[#A7F3D0]', glow: 'shadow-[0_6px_20px_-10px_rgba(16,185,129,0.45)]' },
  amber: { text: 'text-[#92400E]', dot: 'bg-[#F59E0B]', pill: 'bg-[#FFFBEB]', ring: 'border-[#FDE68A]', iconRing: 'ring-[#FDE68A]', glow: 'shadow-[0_6px_20px_-10px_rgba(245,158,11,0.45)]' },
  rose: { text: 'text-[#9F1239]', dot: 'bg-[#F43F5E]', pill: 'bg-[#FFF1F2]', ring: 'border-[#FECDD3]', iconRing: 'ring-[#FECDD3]', glow: 'shadow-[0_6px_20px_-10px_rgba(244,63,94,0.4)]' },
  slate: { text: 'text-[#475569]', dot: 'bg-[#94A3B8]', pill: 'bg-sand', ring: 'border-[#E6E4DD]', iconRing: 'ring-[#E6E4DD]', glow: '' },
};
