/** @type {import('tailwindcss').Config} */
// "Warm Alabaster & Legal Ink": warm alabaster canvas, translucent crisp ivory elevated surfaces, deep slate ink, royal civic indigo.
// Daylight only. Zero eye-strain. No pure white canvas, no dark mode.
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
        canvas: '#F8F7F4',   // Warm Alabaster / Parchment (global background)
        sand: '#F1EFEA',     // Soft Sand (secondary surfaces, sidebars, metadata headers)
        ivory: 'rgba(255, 255, 255, 0.88)', // Translucent Crisp Ivory
        stone: '#E6E4DD',    // Warm Hairline Stone
        rule: '#E6E4DD',     // Warm Hairline Stone borders & rules
        hairline: '#E6E4DD',
        ink: '#1E293B',      // Deep Slate (primary text & legal quotes)
        legal: '#1E293B',    // Deep Slate (primary text & legal quotes)
        mist: '#64748B',     // Cool Gray Slate (secondary metadata, GR numbers, dates)
        faint: '#64748B',    // Cool Gray Slate
        civic: '#4F46E5',    // Royal Civic Indigo (buttons, active tabs, graph links)
        lavender: '#EEF2FF', // Soft Lavender wash (hover/active states on citation chips)
        iris: {
          50: '#EEF2FF',     // Soft Lavender wash
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',    // Royal Civic Indigo
          700: '#4338CA',
          800: '#3730A3',
        },
        gold: {
          300: '#FDE68A',
          400: '#F59E0B',
          500: '#D97706',
          600: '#92400E',
        },
      },
      borderColor: {
        hair: '#E6E4DD',
        stone: '#E6E4DD',
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        elevated: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        float: '0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 24px 56px -16px rgba(15, 23, 42, 0.16)',
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
