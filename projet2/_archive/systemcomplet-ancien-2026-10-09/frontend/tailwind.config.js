
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        // ── V4 Design Tokens ──────────────────────────────────
        'globus-primary': '#385AA6',
        'globus-accent': '#FB8C43',
        'globus-bg': '#F4F4F4',
        // Extended palette
        'globus-primary-light': '#4A6DB8',
        'globus-primary-dark': '#2A4785',
        'globus-accent-light': '#FCA465',
        'globus-accent-dark': '#E07A35',
        // ── Backward-compat aliases (existing pages) ──────────
        'globus-blue': '#385AA6',
        'globus-orange': '#FB8C43',
        'globus-orange-hover': '#E07A35',
        'seconda-blue': '#C4D4F0',
        'globus-gray': '#687280',
        'globus-light': '#F4F4F4',
        'globus-blue-dark': '#1e3a5f',
      },
      fontFamily: {
        // ── V4 Fonts ──────────────────────────────────────────
        gilroy: ['Gilroy', 'Montserrat', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        doxent: ['Doxent', 'Georgia', 'serif'],
        // ── Backward-compat aliases ───────────────────────────
        montserrat: ['Gilroy', 'Montserrat', 'sans-serif'],
        opensans: ['Poppins', 'Open Sans', 'sans-serif'],
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
