// See: https://v3.tailwindcss.com/docs/installation
// notice this is tailwindcss v3. 
// v4 no longer use tailwind.config.js

/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./src/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0A1628', hover: '#122040' },
        gold: { DEFAULT: '#C9922A', light: '#E8B84B', tint: '#FDF3DC' },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
