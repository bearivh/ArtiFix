/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#FAF8F4',
          warm: '#F5F1EA',
        },
        pure: '#FFFFFF',
        bronze: {
          DEFAULT: '#5C4B37',
          dark: '#4A3C2B',
          light: '#8B7355',
          glow: '#A68B5B',
          muted: '#EDE6DC',
          subtle: '#F7F3EE',
        },
        navy: {
          DEFAULT: '#0f1b2d',
          dark: '#0a1220',
          card: '#152238',
          border: '#1e3a5f',
        },
        forest: {
          DEFAULT: '#1b4332',
          dark: '#14532d',
          light: '#2d6a4f',
          glow: '#40916c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(74, 60, 43, 0.06), 0 4px 16px rgba(74, 60, 43, 0.04)',
        bronze: '0 0 0 1px rgba(92, 75, 55, 0.12), 0 4px 20px rgba(74, 60, 43, 0.08)',
        'bronze-glow': '0 0 0 1px rgba(166, 139, 91, 0.25), 0 4px 24px rgba(166, 139, 91, 0.12)',
      },
    },
  },
  plugins: [],
}
