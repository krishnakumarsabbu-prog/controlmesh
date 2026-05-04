import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ControlMesh surface ramp — deep navy hierarchy
        surface: {
          base:    '#0B0F1A',
          raised:  '#0F1523',
          card:    '#141B2D',
          overlay: '#1A2236',
          border:  '#1E2A3D',
          muted:   '#2A3550',
        },
        text: {
          primary:   '#E5E7EB',
          secondary: '#9CA3AF',
          muted:     '#6B7280',
          accent:    '#818CF8',
        },
        // Primary indigo — ControlMesh brand
        primary: {
          DEFAULT: '#6366F1',
          hover:   '#4F46E5',
          dim:     'rgba(99,102,241,0.12)',
          glow:    'rgba(99,102,241,0.35)',
        },
        // Legacy accent aliases for backward compat
        accent: {
          blue:         '#6366F1',
          'blue-hover': '#4F46E5',
          emerald:      '#22C55E',
          amber:        '#F59E0B',
          red:          '#EF4444',
          cyan:         '#06B6D4',
        },
        // Semantic color ramps
        success: { DEFAULT: '#22C55E', dim: 'rgba(34,197,94,0.12)',  glow: 'rgba(34,197,94,0.3)'  },
        warning: { DEFAULT: '#F59E0B', dim: 'rgba(245,158,11,0.12)', glow: 'rgba(245,158,11,0.3)' },
        danger:  { DEFAULT: '#EF4444', dim: 'rgba(239,68,68,0.12)',  glow: 'rgba(239,68,68,0.3)'  },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(99,102,241,0.25)' },
          '50%':      { boxShadow: '0 0 24px rgba(99,102,241,0.55)' },
        },
        'glow-pulse-green': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(34,197,94,0.2)' },
          '50%':      { boxShadow: '0 0 20px rgba(34,197,94,0.5)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ping-slow': {
          '0%':   { transform: 'scale(1)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(99,102,241,0.3)' },
          '50%':      { borderColor: 'rgba(99,102,241,0.7)' },
        },
      },
      animation: {
        'fade-in':          'fade-in 0.3s ease-out both',
        'slide-in-left':    'slide-in-left 0.25s ease-out both',
        'slide-up':         'slide-up 0.3s ease-out both',
        'glow-pulse':       'glow-pulse 2.5s ease-in-out infinite',
        'glow-pulse-green': 'glow-pulse-green 2.5s ease-in-out infinite',
        'shimmer':          'shimmer 2.5s linear infinite',
        'ping-slow':        'ping-slow 1.8s ease-out infinite',
        'border-glow':      'border-glow 2.5s ease-in-out infinite',
      },
      boxShadow: {
        card:         '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'card-glow':  '0 0 0 1px rgba(99,102,241,0.35), 0 8px 24px rgba(99,102,241,0.12)',
        sidebar:      '1px 0 0 rgba(255,255,255,0.04)',
        glow:         '0 0 24px rgba(99,102,241,0.3)',
        'glow-green': '0 0 20px rgba(34,197,94,0.25)',
        'glow-amber': '0 0 20px rgba(245,158,11,0.25)',
        'glow-red':   '0 0 20px rgba(239,68,68,0.25)',
        'inner-top':  'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'gradient-card':    'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
        'gradient-indigo':  'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        'gradient-green':   'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
        'gradient-amber':   'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-red':     'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'shimmer-line':     'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #0F1523 0%, #0B0F1A 100%)',
        'mesh-pattern':     'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(34,197,94,0.03) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
