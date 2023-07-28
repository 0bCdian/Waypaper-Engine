/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
    require('daisyui')
  ],

  daisyui: {
    darkTheme: 'business', // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    rtl: false, // rotate style direction from left-to-right to right-to-left. You also need to add dir="rtl" to your html tag and install `tailwindcss-flip` plugin for Tailwind CSS.
    prefix: '', // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: true, // S
    themes: [
      'light',
      'dark',
      'retro',
      'business',
      {
        gruv: {
          primary: '#bbf7d0',

          secondary: '#dda044',

          accent: '#8ad83c',

          neutral: '#1b1d22',

          'base-100': '#292828',

          info: '#5c99f0',

          success: '#159947',

          warning: '#f4bf1f',

          error: '#f44125'
        }
      }
    ]
  }
}
