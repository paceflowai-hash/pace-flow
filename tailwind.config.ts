import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        pace: {
          synced: 'var(--pace-synced)',
          warning: 'var(--pace-warning)',
          danger: 'var(--pace-danger)',
          info: 'var(--pace-info)',
        },
        accent: {
          primary: 'var(--accent-primary)',
        },
        surface: {
          glass: 'var(--surface-glass)',
          border: 'var(--surface-border)',
          hover: 'var(--surface-hover)',
        },
      },
      fontSize: {
        'speed-display': 'var(--font-speed-display)',
        'speed-unit': 'var(--font-speed-unit)',
        'network-count': 'var(--font-network-count)',
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'breathing-synced': 'breathe-synced 4s ease-in-out infinite',
        'breathing-warning': 'breathe-warning 2s ease-in-out infinite',
        'breathing-danger': 'breathe-danger 1s ease-in-out infinite',
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 350ms cubic-bezier(0.32, 0.72, 0, 1)',
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'breathe-synced': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '0.15' },
        },
        'breathe-warning': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '0.20' },
        },
        'breathe-danger': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '0.25' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      spacing: {
        'safe-top': 'var(--safe-area-top)',
        'safe-bottom': 'var(--safe-area-bottom)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};

export default config;
