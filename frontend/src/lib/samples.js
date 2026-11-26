// Real questions, each checked live against the bundled collection (docs/DEMO.md). `kind` picks the colour and the badge.
export const SAMPLES = [
  {
    kind: 'amended',
    badge: 'Amended rule',
    label: 'Health Worker age limit + 2022 amendment',
    text: 'What is the upper age limit for direct selection of a Multi Purpose Health Worker (Male), and was it changed by any amendment?',
  },
  {
    kind: 'en',
    badge: 'English',
    label: 'Where to apply for Leave / LTC',
    text: 'Which documents or applications are required for leave and LTC, and where must they be submitted?',
  },
  {
    kind: 'gu',
    badge: 'ગુજરાતી',
    label: 'ભરતી (પરીક્ષા) નિયમો ૨૦૨૧ના સુધારા',
    text: 'ગુજરાત પંચાયત સેવા (વર્ગ-૩) ભરતી (પરીક્ષા) નિયમો, ૨૦૨૧માં કયા સુધારા કરવામાં આવ્યા?',
  },
  {
    kind: 'mixed',
    badge: 'Gujlish',
    label: 'Leave ane LTC ni arji kya?',
    text: 'Leave ane LTC ni arji kaya application ma karvani farjiyat che?',
  },
  {
    kind: 'refusal',
    badge: 'Not in the corpus',
    label: 'Maternity leave days',
    text: 'How many days of maternity leave are allowed to women government employees?',
  },
  {
    kind: 'en',
    badge: 'Scanned order, 2001',
    label: 'LTC suspension (2001)',
    text: 'What did the 2001 resolution decide about Home Town LTC and All India LTC under the Central Civil Services (LTC) Rules?',
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
