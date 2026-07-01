/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      colors: {
        // Design system — semantic tokens (see src/styles/design-tokens.css)
        // Note: legacy `surface` key below retains #F8F7FC; use --color-surface / bg-surface-elevated until migrated.
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        'surface-elevated': 'var(--color-surface-elevated)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          foreground: 'var(--color-on-primary)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-on-secondary)',
        },
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        // Design review required: focus-ring, disabled

        surface: 'var(--color-surface)',
      },
      boxShadow: {
        'dropdown': '0 8px 24px -4px rgba(46, 34, 30, 0.12), 0 4px 8px -4px rgba(46, 34, 30, 0.06)',
        'card': '0 1px 3px 0 rgba(46, 34, 30, 0.06), 0 1px 2px -1px rgba(46, 34, 30, 0.04)',
        'card-hover': '0 4px 12px -2px rgba(46, 34, 30, 0.1), 0 2px 6px -2px rgba(46, 34, 30, 0.05)',
        'header': '0 4px 20px -4px rgba(46, 34, 30, 0.12), 0 1px 0 var(--color-border)',
        'wizard-panel':
          '0 8px 24px -8px rgba(171, 53, 0, 0.09), -4px 2px 16px -12px rgba(171, 53, 0, 0.04), 4px 2px 16px -12px rgba(171, 53, 0, 0.04)',
        'footer-up': '0 -4px 12px rgba(171, 53, 0, 0.08)',
        'podium': '0 8px 24px -4px rgba(46, 34, 30, 0.12), 0 4px 8px -4px rgba(46, 34, 30, 0.06)',
        'glow-brand': '0 0 20px color-mix(in srgb, var(--color-primary) 25%, transparent)',
        'glow-gold': '0 0 24px color-mix(in srgb, var(--color-warning) 35%, transparent)',
        'glow-emerald': '0 0 20px color-mix(in srgb, var(--color-success) 30%, transparent)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'celebration-bounce': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent)' },
          '50%': { boxShadow: '0 0 40px color-mix(in srgb, var(--color-primary) 60%, transparent)' },
        },
        'glow-pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 16px color-mix(in srgb, var(--color-warning) 30%, transparent)' },
          '50%': { boxShadow: '0 0 32px color-mix(in srgb, var(--color-warning) 50%, transparent)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-100%) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float-up': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '30%': { opacity: '1', transform: 'translateY(-30px) scale(1.3)' },
          '100%': { opacity: '0', transform: 'translateY(-80px) scale(0.8)' },
        },
        'toast-enter': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-exit': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(16px) scale(0.95)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%, 45%, 75%': { transform: 'translateX(-4px)' },
          '30%, 60%, 90%': { transform: 'translateX(4px)' },
        },
        'crown-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-warning) 40%, transparent))' },
          '50%': { filter: 'drop-shadow(0 0 12px color-mix(in srgb, var(--color-warning) 80%, transparent))' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' },
          '50%': { borderColor: 'color-mix(in srgb, var(--color-primary) 60%, transparent)' },
        },
        'screen-flash': {
          '0%': { opacity: '0.7' },
          '100%': { opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.4s ease-out forwards',
        'celebration-bounce': 'celebration-bounce 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-pulse-gold': 'glow-pulse-gold 2s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 3s ease-in forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pop-in': 'pop-in 0.3s ease-out forwards',
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'float-up': 'float-up 1s ease-out forwards',
        'toast-enter': 'toast-enter 0.3s ease-out forwards',
        'toast-exit': 'toast-exit 0.2s ease-in forwards',
        'shake': 'shake 0.5s ease-in-out',
        'crown-glow': 'crown-glow 2s ease-in-out infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
        'screen-flash': 'screen-flash 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}
