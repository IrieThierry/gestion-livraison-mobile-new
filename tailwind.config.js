/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#10b981',
        },
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
        danger: '#ef4444',
        accent: '#8b5cf6',
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px' },
    },
  },
  plugins: [],
}
