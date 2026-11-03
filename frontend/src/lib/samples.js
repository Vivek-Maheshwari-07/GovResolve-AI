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

// Quiet by design: one small coloured dot per kind is the only colour signal
export const KIND_STYLE = {
  en: { dot: 'bg-iris-500' },
  amended: { dot: 'bg-[#D98A1F]' },
  gu: { dot: 'bg-[#4F8A74]' },
  mixed: { dot: 'bg-iris-300' },
  refusal: { dot: 'bg-[#C2395A]' },
};
