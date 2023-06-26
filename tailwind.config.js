/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        bg_main: '#606C5D',
        fg_main: '#FFF4F4',
        accent_main: '#F1C376',
        secondary_main: '#F7E6C4'
      }
    }
  },
  plugins: []
}
