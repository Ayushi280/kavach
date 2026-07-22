/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Kavach command-centre palette
        bg: {
          DEFAULT: '#0A0E1A',
          deep: '#070A13',
          navy: '#0F1629',
        },
        surface: {
          DEFAULT: '#141B2D',
          raised: '#1A2338',
          hover: '#1E2942',
        },
        border: {
          DEFAULT: '#1E293B',
          bright: '#2A3654',
        },
        accent: {
          blue: '#059669',   // deep emerald (was #3B82F6)
          cyan: '#34D399',   // bright emerald (was #22D3EE)
          cyanDim: '#0F766E',
        },
        threat: {
          DEFAULT: '#EF4444',
          dim: '#7F1D1D',
          glow: 'rgba(239, 68, 68, 0.35)',
        },
        safe: {
          DEFAULT: '#22C55E',
          dim: '#14532D',
        },
        warn: {
          DEFAULT: '#F59E0B',
          dim: '#78350F',
        },
        ink: {
          DEFAULT: '#F8FAFC',
          muted: '#94A3B8',
          dim: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'glow-threat': '0 0 24px -2px rgba(239, 68, 68, 0.55), 0 0 0 1px rgba(239, 68, 68, 0.25)',
        'glow-safe': '0 0 24px -2px rgba(34, 197, 94, 0.4), 0 0 0 1px rgba(34, 197, 94, 0.2)',
        'glow-cyan': '0 0 24px -4px rgba(52, 211, 153, 0.4)',
      },
      animation: {
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.4)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          "linear-gradient(rgba(30, 41, 59, 0.35) 1px, transparent 1px), linear-gradient(to right, rgba(30, 41, 59, 0.35) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid-lg': '48px 48px',
        'grid-sm': '24px 24px',
      },
    },
  },
  plugins: [],
}