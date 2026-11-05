
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        'globus-blue': '#385AA6',
        'globus-orange': '#FB8C43',
        'globus-orange-hover': '#e07a35',
        'seconda-blue': '#C5D4EE',
        'globus-gray': '#687280',
        'globus-light': '#F4F4F4',
        'globus-blue-dark': '#2A4580',
        'globus-blue-light': '#4A72C4',
        'globus-accent': '#FB8C43',
        'globus-bg': '#F4F4F4',
        'globus-text': '#2D2D2D',
        'globus-success': '#16A34A',
        'globus-warning': '#EAB308',
        'globus-danger': '#DC2626',
      },
      fontFamily: {
        gilroy: ['Gilroy', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        doxent: ['Doxent', 'sans-serif'],
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
