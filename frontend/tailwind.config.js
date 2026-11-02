/** @type {import('tailwindcss').Config} */
// "Warm Alabaster & Legal Ink": paper-toned canvas, deep slate ink, executive precision.
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
        iris: { 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3' },
      },
      borderColor: { hair: '#E6E4DD' },
      boxShadow: {
        lift: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.04)',
        float: '0 12px 36px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
        glowIris: '0 0 20px -3px rgba(79, 70, 229, 0.35)',
        glowAmber: '0 0 20px -3px rgba(245, 158, 11, 0.35)',
      },
      keyframes: {
        pulseDot: { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.45, transform: 'scale(1.5)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pingSoft: { '75%, 100%': { transform: 'scale(1.8)', opacity: 0 } },
      },
      animation: {
        pulseDot: 'pulseDot 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        pingSoft: 'pingSoft 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
