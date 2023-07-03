/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        bg_main: '#222831',
        fg_main: '#EEEEEE',
        accent_main: '#00ADB5',
        secondary_main: '#393E46'
      }
    }
  },
  plugins: [require('tailwind-scrollbar')({ nocompatible: true })]
}
