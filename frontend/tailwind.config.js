/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serifDisplay: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -22px 42px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.42)',
      },
    },
  },
  plugins: [],
};
