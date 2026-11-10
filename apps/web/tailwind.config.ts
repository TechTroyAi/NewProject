import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="midnight"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        note: 'rgb(var(--note) / <alpha-value>)',
        series: 'rgb(var(--series) / <alpha-value>)',
        chapter: 'rgb(var(--chapter) / <alpha-value>)',
        wiki: 'rgb(var(--wiki) / <alpha-value>)',
        good: 'rgb(var(--good) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      // Finer opacity steps than the default scale — used heavily by the
      // hairline borders and tinted surfaces.
      opacity: {
        4: '0.04', 5: '0.05', 6: '0.06', 7: '0.07', 8: '0.08',
        12: '0.12', 13: '0.13', 14: '0.14', 15: '0.15', 16: '0.16',
        18: '0.18', 22: '0.22', 35: '0.35', 45: '0.45', 55: '0.55',
        65: '0.65', 85: '0.85',
      },
      boxShadow: {
        pop: '0 24px 60px -24px rgb(0 0 0 / 0.75)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -18px rgb(0 0 0 / 0.7)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.4), 0 0 24px -6px rgb(var(--accent) / 0.5)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up .32s cubic-bezier(.2,.7,.3,1) both',
        'fade-in': 'fade-in .2s ease both',
        'scale-in': 'scale-in .16s cubic-bezier(.2,.7,.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
