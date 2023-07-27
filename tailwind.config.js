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
      },
      keyframes: {
        'pop-in': {
          '0%': { scale: 0 },
          '100%': { scale: 1 }
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.45s ease-in-out',
        'pop-in': 'pop-in 0.15s ease-in'
      }
    }
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
    require('@tailwindcss/forms')
  ]
}
