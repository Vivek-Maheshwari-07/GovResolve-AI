/** @type {import('tailwindcss').Config} */
// "Warm Alabaster & Legal Ink": paper-toned canvas, deep slate ink, no pure white page, no pure black text.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
        gujarati: ['"Noto Sans Gujarati"', '"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['Merriweather', '"Noto Sans Gujarati"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#F8F7F4',   // main app canvas (warm alabaster)
        sand: '#F1EFEA',     // muted surface: metadata bars, pill containers
        stone: '#E6E4DD',    // hairline borders
        legal: '#1E293B',    // primary text (deep slate ink)
        mist: '#64748B',     // secondary text
        iris: { 50: '#EEF2FF', 100: '#E0E7FF', 400: '#6366F1', 500: '#4F46E5', 600: '#4338CA', 700: '#3730A3' },
      },
      borderColor: { hair: '#E6E4DD' },
      boxShadow: { lift: '0 4px 20px -2px rgba(15, 23, 42, 0.05)' },
      keyframes: {
        pulseDot: { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.45, transform: 'scale(1.5)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: { pulseDot: 'pulseDot 2.4s ease-in-out infinite', shimmer: 'shimmer 2.2s linear infinite' },
    },
  },
  plugins: [],
};
