/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--ui-background)',
        foreground: 'var(--ui-foreground)',
        surface: 'var(--ui-surface)',
        primary: {
          DEFAULT: 'var(--ui-primary)',
          hover: 'var(--ui-primary-hover)',
          soft: 'var(--ui-primary-soft)',
        },
        accent: {
          DEFAULT: 'var(--ui-accent)',
          hover: 'var(--ui-accent-hover)',
          soft: 'var(--ui-accent-soft)',
        },
        muted: {
          DEFAULT: 'var(--ui-muted)',
          foreground: 'var(--ui-muted-foreground)',
        },
        subtle: 'var(--ui-subtle-foreground)',
        'ui-border': {
          DEFAULT: 'var(--ui-border)',
          strong: 'var(--ui-border-strong)',
        },
        success: {
          DEFAULT: 'var(--ui-success)',
          soft: 'var(--ui-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--ui-warning)',
          soft: 'var(--ui-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--ui-danger)',
          soft: 'var(--ui-danger-soft)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        title: ['1rem', { lineHeight: '1.5rem' }],
        heading: ['1.125rem', { lineHeight: '1.75rem' }],
        display: ['1.5rem', { lineHeight: '2rem' }],
      },
      borderRadius: {
        control: 'var(--ui-radius-control)',
        card: 'var(--ui-radius-card)',
      },
      boxShadow: {
        card: 'var(--ui-shadow-card)',
        raised: 'var(--ui-shadow-raised)',
        overlay: 'var(--ui-shadow-overlay)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
