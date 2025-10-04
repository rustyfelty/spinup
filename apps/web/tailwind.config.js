/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      },
      colors: {
        // Primary brand color - Fully customizable via CSS variables
        // All shades are auto-generated from the primary color selected in Settings
        'game-purple': {
          50: '#f5f3ff',
          100: 'var(--color-game-purple-100, #ede9fe)',  // Auto-lightened
          200: 'var(--color-game-purple-200, #ddd6fe)',  // Auto-lightened
          300: 'var(--color-game-purple-300, #c4b5fd)',  // Auto-lightened
          400: 'var(--color-game-purple-400, #a78bfa)',  // Auto-lightened
          500: 'var(--color-game-purple, #9146ff)',      // Base color (customizable)
          600: 'var(--color-game-purple-600, #7c3aed)',  // Auto-darkened
          700: 'var(--color-game-purple-700, #6d28d9)',  // Auto-darkened
          800: 'var(--color-game-purple-800, #5b21b6)',  // Auto-darkened
          900: 'var(--color-game-purple-900, #4c1d95)',  // Auto-darkened
        },
        // Secondary accent color - Customizable via CSS variables
        'game-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: 'var(--color-game-green, #22c55e)',  // Customizable
          600: 'var(--color-game-green-600, #16a34a)',  // Auto-darkened
          700: 'var(--color-game-green-700, #15803d)',  // Auto-darkened
          800: '#166534',
          900: '#14532d',
        },
        // Danger/error color - Customizable via CSS variables
        'game-red': {
          50: '#fef2f2',
          100: '#fde8e8',
          200: '#fbd5d5',
          300: '#f8b4b4',
          400: '#f98080',
          500: 'var(--color-game-red, #dc2626)',  // Customizable
          600: 'var(--color-game-red-600, #dc3a3a)',  // Auto-darkened
          700: 'var(--color-game-red-700, #b82e2e)',  // Auto-darkened
          800: '#942424',
          900: '#771c1c',
        },
        // Dark theme colors
        'game-dark': {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        }
      },
      boxShadow: {
        'game': '0 6px 0 0 rgba(0,0,0,0.4)',
        'game-light': '0 4px 0 0 rgba(0,0,0,0.2)',
        'game-sm': '0 3px 0 0 rgba(0,0,0,0.3)',
      },
      borderRadius: {
        'pixel': '2px',
        'pixel-lg': '4px',
      }
    },
  },
  plugins: [],
}