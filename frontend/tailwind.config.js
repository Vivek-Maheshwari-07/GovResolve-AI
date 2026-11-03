/** @type {import('tailwindcss').Config} */
// "Paper & Ink": warm paper canvas, deep navy ink, civic-blue actions, one saffron accent. Status colours are semantic only.
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
        canvas: '#FBFAF6',   // warm paper
        sand: '#F4F2EB',     // muted surface
        stone: '#E8E4D9',    // hairline borders
        legal: '#0F1B33',    // primary text (deep navy ink)
        mist: '#5B6678',     // secondary text
        saffron: { 400: '#F2A33A', 500: '#E8890C', 600: '#C96F05' },
        iris: { 50: '#F0F4FF', 100: '#E0E9FF', 200: '#C4D3FF', 300: '#9BB2FF', 400: '#6486F4', 500: '#3E62E6', 600: '#2A4BD0', 700: '#2139A8', 800: '#1B2F86' },
      },
      borderColor: { hair: '#E8E4D9' },
      boxShadow: {
        lift: '0 1px 2px rgba(15, 27, 51, 0.04), 0 8px 24px -8px rgba(15, 27, 51, 0.08)',
        card: '0 1px 2px rgba(15, 27, 51, 0.04), 0 2px 10px rgba(15, 27, 51, 0.04)',
        float: '0 18px 48px -12px rgba(15, 27, 51, 0.16), 0 4px 12px -2px rgba(15, 27, 51, 0.06)',
        glowIris: '0 8px 24px -6px rgba(42, 75, 208, 0.45)',
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
