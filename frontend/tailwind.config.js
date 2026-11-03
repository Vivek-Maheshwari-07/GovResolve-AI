/** @type {import('tailwindcss').Config} */
// "The Gazette Dossier": warm alabaster canvas, ivory sheets, deep legal-slate ink, civic indigo.
// Daylight only. No pure white canvas, no pure black text. Status colours are jewel pastels and semantic only.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', '"Noto Sans Gujarati"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#F8F7F4',   // warm alabaster
        sand: '#F1EFEA',     // recessed wells, muted fills
        ivory: '#FDFCF9',    // sheets (never pure white)
        stone: '#E4E1D8',    // hairlines
        rule: '#D6D2C5',     // stronger rules, crop marks
        ink: '#0F172A',      // deepest ink
        legal: '#1E293B',    // primary text
        mist: '#556075',     // secondary text (AA on canvas)
        faint: '#8A93A4',    // placeholders, tertiary
        iris: { 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3' },
        gold: { 300: '#FCD34D', 400: '#F5B83D', 500: '#D97706', 600: '#B45309' },
      },
      borderColor: { hair: '#E4E1D8' },
      boxShadow: {
        card: '0 1px 2px rgba(30, 41, 59, 0.05), 0 2px 8px -2px rgba(30, 41, 59, 0.06)',
        float: '0 2px 4px rgba(30, 41, 59, 0.05), 0 24px 56px -16px rgba(30, 41, 59, 0.22)',
      },
      keyframes: {
        pulseDot: { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.45, transform: 'scale(1.5)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pingSoft: { '75%, 100%': { transform: 'scale(1.8)', opacity: 0 } },
        slide: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(320%)' } },
        sweep: { '0%': { transform: 'translateY(-4%)', opacity: 0 }, '12%': { opacity: 1 }, '88%': { opacity: 1 }, '100%': { transform: 'translateY(104%)', opacity: 0 } },
        floatY: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        pulseDot: 'pulseDot 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        pingSoft: 'pingSoft 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        slide: 'slide 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        sweep: 'sweep 1.3s cubic-bezier(0.4, 0, 0.2, 1) 1',
        floatY: 'floatY 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
