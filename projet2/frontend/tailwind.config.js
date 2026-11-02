
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        'globus-blue': '#1D4ED8',
        'globus-orange': '#F97316',
        'globus-orange-hover': '#ea580c',
        'seconda-blue': '#BFDBFE',
        'globus-gray': '#687280',
        'globus-light': '#F9FAFB',
        'globus-blue-dark': '#1e3a5f',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        opensans: ['Open Sans', 'sans-serif'],
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      },
      animation: {
        'scroll': 'scroll 30s linear infinite',
      }
    },
  },
  plugins: [],
}
