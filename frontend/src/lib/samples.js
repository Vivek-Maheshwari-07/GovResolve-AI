// Real questions from the demo set (backend/DEMO.md). `kind` picks the colour and the badge.
export const SAMPLES = [
  {
    kind: 'en',
    badge: 'English',
    label: 'Mobile tariff date',
    text: 'From which date did the new mobile phone tariff for government use apply, and whose offer was accepted?',
  },
  {
    kind: 'amended',
    badge: 'Amended rule',
    label: 'Age limit relaxed in 2022',
    text: 'By how much was the upper age limit relaxed for direct selection under the Gujarat Civil Services Classification and Recruitment (General) Rules, 1967, in 2022?',
  },
  {
    kind: 'gu',
    badge: 'ગુજરાતી',
    label: 'બંધારણ આમુખ વાંચન ક્યાં?',
    text: '૨૬ નવેમ્બર ૨૦૨૦ના રોજ બંધારણના આમુખના વાંચનનો રાજ્ય સરકારનો કાર્યક્રમ સચિવાલયમાં ક્યાં યોજાશે?',
  },
  {
    kind: 'mixed',
    badge: 'Gujlish',
    label: 'Navo mobile tariff kyare thi?',
    text: 'Government na mobile phone mate navo tariff kya divas thi lagu thayo ane kai company ni offer swikari?',
  },
  {
    kind: 'refusal',
    badge: 'Not in the corpus',
    label: 'Maternity leave days',
    text: 'How many days of maternity leave are allowed to women government employees?',
  },
  {
    kind: 'amended',
    badge: 'Rule Timeline Demo',
    label: 'Section Officer Rules (1983-2026)',
    text: 'Which Act replaced the entry at serial no. 5 of Paper II (Service Matters-2) by the May 2026 amendment of the Section Officer, Class-II Departmental Examination Rules?',
  },
];

// one colour family per kind (light washes, deep text)
export const KIND_STYLE = {
  en: { chip: 'border-indigo-200 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500', card: 'from-indigo-50 to-white border-indigo-100 hover:border-indigo-300' },
  amended: { chip: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500', card: 'from-amber-50 to-white border-amber-100 hover:border-amber-300' },
  gu: { chip: 'border-teal-200 bg-teal-50 text-teal-700', dot: 'bg-teal-500', card: 'from-teal-50 to-white border-teal-100 hover:border-teal-300' },
  mixed: { chip: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500', card: 'from-violet-50 to-white border-violet-100 hover:border-violet-300' },
  refusal: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500', card: 'from-rose-50 to-white border-rose-100 hover:border-rose-300' },
};
